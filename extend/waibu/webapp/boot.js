/**
 * @module WebAppBoot
 */

/**
 * @external TWebAppBoot
 * @see {@link https://ardhi.github.io/waibu/docs/module-WebApp.html#~TWebAppBoot|Waibu.TWebAppBoot}
 */

/**
 * @external bootHandler
 * @see {@link https://ardhi.github.io/waibu/docs/module-WebApp.html#~bootHandler|Waibu.bootHandler}
 */

/**
 * Waibu WebApp object definition,
 *
 * @memberof module:WebAppBoot
 * @type {external:TWebAppBoot}
 * @property {number} [level=10] - The boot level of the Waibu WebApp, indicating the order in which it should be initialized relative to other components.
 * @property {external:bootHandler} handler - The boot handler function responsible for initializing the application during the boot process.
 */
const webAppBoot = {
  level: 10,
  handler: async function (prefix) {
    const { importModule } = this.app.bajo
    const {
      routeHook, handleCors, handleHelmet, handleCompress, handleRateLimit
    } = await importModule('waibu:/lib/webapp.js', { asDefaultImport: false })

    await handleRateLimit.call(this, this.config.rateLimit)
    await handleCors.call(this, this.config.cors)
    await handleHelmet.call(this, this.config.helmet)
    await handleCompress.call(this, this.config.compress)
    await routeHook.call(this, this.ns)
    await this._handleAsset(prefix)
    await this._handleVirtual(prefix)
  }
}

export default webAppBoot
