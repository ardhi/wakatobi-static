import path from 'path'
import config from './lib/config.js'

/**
 * Plugin factory.
 *
 * **Never** call this function directly!!! It's only-meant to be called by the {@link https://ardhi.github.io/bajo|Bajo framework} during plugin initialization.
 *
 * @param {string} pkgName - NPM package name
 * @returns {WaibuStatic} - WaibuStatic class
 */
async function factory (pkgName) {
  const me = this

  /**
   * WaibuStatic class definition.
   *
   * @class
   */
  class WaibuStatic extends this.app.baseClass.Base {
    constructor () {
      super(pkgName, me.app)
      /**
       * @member {string[]} routePathHandlers - List of route path handlers
       */
      this.routePathHandlers = ['asset', 'virtual']
      /**
       * @member {TConfig} config - Configuration object
       */
      this.config = config
    }

    /**
     * Initialize the plugin.
     *
     * @async
     * @method
     * @returns {Promise<void>}
     * @private
     */
    init = async () => {
      const { trim } = this.app.lib._
      this.config.waibu.prefix = trim(this.config.waibu.prefix, '/')
    }

    /**
     * Get the asset directory for a given namespace.
     *
     * @method
     * @param {string} ns - Namespace
     * @returns {string} - Asset directory real path
     */
    assetDir = (ns) => {
      const { getPluginPrefix } = this.app.waibu
      const prefix = this.config.waibu.prefix
      const dir = prefix === '' ? '' : `/${prefix}`
      if (!ns) return dir
      return dir + '/' + getPluginPrefix(ns, 'waibuStatic')
    }

    /**
     * Get the route path for a given resource name.
     *
     * @method
     * @param {string} name - Resource name
     * @param {Object} [options] - Options
     * @param {boolean} [options.uriEncoded=true] - Whether to URI encode the path
     * @returns {string} - Route path
     */
    routePath = (name, { uriEncoded = true } = {}) => {
      let { ns, fullPath, subNs } = this.app.bajo.breakNsPath(name)
      const prefix = subNs === 'virtual' ? this.virtualDir(ns) : this.assetDir(ns)
      if (uriEncoded) fullPath = fullPath.split('/').map(p => encodeURI(p)).join('/')
      return `${prefix}${fullPath}`.replace('//', '/')
    }

    /**
     * Get the virtual directory for a given namespace.
     *
     * @method
     * @param {string} ns - Namespace
     * @returns {string} - Virtual directory real path
     */
    virtualDir = (ns) => {
      const { getPluginPrefix } = this.app.waibu
      const { trimEnd } = this.app.lib._
      const plugin = this.app.getPlugin(ns)
      const prefix = this.config.waibu.prefix
      const virtPrefix = this.app.waibu.config.prefixVirtual
      const dir = prefix === '' ? '' : `/${prefix}`
      return trimEnd(`${dir}/${virtPrefix}/${getPluginPrefix(plugin.ns, 'waibuStatic')}`, '/')
    }

    /**
     * List resources for a given resource name.
     *
     * @async
     * @method
     * @param {string} rsc - Resource name
     * @returns {Promise<Array<Object>>} - List of resources
     */
    listResources = async (rsc) => {
      const { getPluginPrefix } = this.app.waibu
      const { fastGlob } = this.app.lib
      const { isEmpty, map, camelCase } = this.app.lib._
      const { breakNsPath, importPkg } = this.app.bajo
      const mime = await importPkg('waibu:mime')
      const { ns, subNs, path: _path } = breakNsPath(rsc)
      if (subNs === 'virtual') return [] // only for assets
      const root = `${this.app[ns].dir.pkg}/extend/${this.ns}/asset`
      let pattern = root
      if (!isEmpty(_path)) pattern += _path
      if (!_path.includes('*')) pattern += '/**/*'
      const prefix = `${this.config.waibu.prefix}/${getPluginPrefix(ns, this.ns)}`
      const files = map(await fastGlob(pattern), file => {
        const href = `/${prefix}${file.replace(root, '')}`
        const ext = path.extname(file)
        const mimeType = mime.getType(ext) ?? ''
        const base = path.basename(file, ext)
        const name = camelCase(base)
        return {
          file,
          href,
          name,
          mimeType
        }
      })
      return files
    }

    // internal methods

    /**
     * Handle asset routes for a given prefix.
     *
     * @async
     * @method
     * @param {string} prefix - Prefix for the asset route
     * @returns {Promise<void>}
     */
    _handleAsset = async (prefix) => {
      const { importPkg, eachPlugins, readConfig } = this.app.bajo
      const { fs } = this.app.lib
      const { getPluginPrefix, isRouteDisabled } = this.app.waibu
      const fastifyStatic = await importPkg('waibu:waibu-fastify-static')
      const me = this
      this.log.trace('serving%s', this.t('assets'))
      await eachPlugins(async function ({ dir }) {
        const { ns } = this
        const root = `${dir}/extend/${me.ns}/asset`
        if (ns === me.app.mainNs) fs.ensureDirSync(root)
        else if (!fs.existsSync(root)) return undefined
        const opts = await readConfig(`${dir}/extend/${me.ns}/options.*`, { ns, ignoreError: true })
        opts.root = root
        opts.prefix = '/' + getPluginPrefix(ns, 'waibuStatic')
        const fullPath = `/${prefix}${opts.prefix}`.replaceAll('//', '/')
        if (isRouteDisabled(fullPath)) {
          me.log.warn('routeDisabled%s', `${fullPath}`)
          return
        }
        opts.decorateReply = false
        if (ns === me.app.mainNs) {
          opts.decorateReply = true
        }
        me.log.trace(`- ${me.assetDir(ns)}/*`)
        opts.config = opts.config ?? {}
        opts.config.webApp = me.ns
        opts.config.ns = ns
        opts.config.subNs = 'asset'
        await me.webAppCtx.register(fastifyStatic, opts)
      })
    }

    /**
     * Handle virtual routes for a given prefix.
     *
     * @async
     * @param {string} prefix - Prefix for the virtual route
     * @returns {Promise<void>}
     * @method
     */
    _handleVirtual = async (prefix) => {
      const { importPkg, eachPlugins, readConfig, getModuleDir } = this.app.bajo
      const { resolvePath } = this.app.lib.aneka
      const { getPluginPrefix, isRouteDisabled } = this.app.waibu
      const fastifyStatic = await importPkg('waibu:waibu-fastify-static')
      const { fs } = this.app.lib
      const { isEmpty, isPlainObject } = this.app.lib._
      const me = this
      this.log.trace('serving%s', this.t('virtuals'))
      await me.webAppCtx.register(async (childCtx) => {
        await eachPlugins(async function ({ dir }) {
          const { ns } = this
          let virts = await readConfig(`${dir}/extend/${me.ns}/virtual.*`, { ns, ignoreError: true, defValue: [] })
          if (isEmpty(virts)) return undefined
          if (isPlainObject(virts)) virts = [virts]
          for (const v of virts) {
            if (isEmpty(v.prefix)) {
              me.log.warn('staticVirtualMustHavePrefix%s', ns)
              continue
            }
            if (isEmpty(v.root)) {
              me.log.warn('staticVirtualMustHaveRoot%s%s', v.prefix, ns)
              continue
            }
            const oRoot = v.root
            if (!path.isAbsolute(v.root)) {
              if (v.root.startsWith('data:')) {
                let [vPlugin, vPath] = v.root.slice(5).split(':')
                if (!vPath) {
                  vPath = vPlugin
                  vPlugin = ns
                }
                v.root = resolvePath(`${me.app.bajo.dir.data}/plugins/${vPlugin}/${vPath}`)
              } else {
                try {
                  const parts = v.root.split(':')
                  if (parts.length === 1) v.root = resolvePath(`${dir}/${v.root}`)
                  else {
                    let [vPlugin, vMod] = parts[0].split('.')
                    const vPath = parts[1]
                    if (!vMod) {
                      vMod = vPlugin
                      vPlugin = ns
                    }
                    const dir = getModuleDir(vMod, vPlugin)
                    v.root = dir
                    if (!isEmpty(vPath)) v.root += vPath
                  }
                } catch (err) {}
              }
            }
            if (!fs.existsSync(v.root)) v.root = this.app.dir + '/' + oRoot
            if (!fs.existsSync(v.root)) {
              me.log.warn('rootOnVirtualNotExists%s%s', v.prefix, ns)
              continue
            }
            const prefix = getPluginPrefix(ns, 'waibuStatic')
            const p = v.prefix
            v.prefix = `${prefix === '' ? '' : ('/' + prefix)}/${p}`
            v.decorateReply = false
            if (ns === me.app.mainNs) {
              v.decorateReply = true
            }
            const fullPath = `/${me.config.waibu.prefix}/${me.app.waibu.config.prefixVirtual}${v.prefix}`.replaceAll('//', '/')
            if (isRouteDisabled(fullPath)) return
            v.config = v.config ?? {}
            v.config.webApp = me.ns
            v.config.ns = ns
            v.config.subNs = 'virtual'
            me.log.trace(`- ${me.virtualDir(ns)}/${p}/*`)
            await childCtx.register(fastifyStatic, v)
          }
        }, { useBajo: true })
      }, { prefix: me.app.waibu.config.prefixVirtual })
    }

    /**
     * Serve the default error page for a given status code.
     *
     * @async
     * @method
     * @param {number} code - HTTP status code
     * @returns {Function} - Handler function for the error page
     */
    _serveDefault = async (code) => {
      const { fs } = this.app.lib
      const { isEmpty } = this.app.lib._
      const me = this

      return function (err, req, reply) {
        const ext = path.extname(req.url)
        code = err ? (err.statusCode ?? code) : code
        reply.code(code)
        let file
        if (!isEmpty(ext)) {
          file = `${me.app[me.app.mainNs].dir}/extend/${me.ns}/asset/rsc/${code}${ext}`
          if (!fs.existsSync(file)) file = `${me.dir.pkg}/extend/${me.ns}/asset/rsc/${code}${ext}`
        }
        if (!fs.existsSync(file)) {
          file = `${me.app[me.app.mainNs].dir}/extend/${me.ns}/asset/rsc/${code}.txt`
          if (!fs.existsSync(file)) file = `${me.dir.pkg}/extend/${me.ns}/asset/rsc/${code}.txt`
          if (!fs.existsSync(file)) file = `${me.dir.pkg}/extend/${me.ns}/asset/rsc/500.txt`
        }
        const content = fs.readFileSync(file, { encoding: 'utf8' })
        return reply.send(content)
      }
    }

    /**
     * Handle internal server errors.
     *
     * @async
     * @method
     * @param {Error} err - Error object
     * @param {Object} req - Request object
     * @param {Object} reply - Reply object
     * @returns {Promise<void>}
     */
    _handleError = async (err, req, reply) => {
      const handler = await this._serveDefault(500)
      return handler(err, req, reply)
    }

    /**
     * Handle not found errors.
     *
     * @async
     * @method
     * @param {Error} err - Error object
     * @param {Object} req - Request object
     * @param {Object} reply - Reply object
     * @returns {Promise<void>}
     */
    _handleNotFound = async (err, req, reply) => {
      const handler = await this._serveDefault(404)
      return handler(err, req, reply)
    }
  }

  return WaibuStatic
}

export default factory
