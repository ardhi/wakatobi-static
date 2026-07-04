/**
 * @typedef {Object} TConfig
 * @type {Object}
 * @property {Object} [waibu={}] - Waibu plugin configuration
 * @property {string} [waibu.prefix='asset'] - Waibu plugin prefix
 * @property {Object} [waibuStatic={}] - WaibuStatic plugin configuration
 * @property {string} [waibuStatic.prefix='static'] - WaibuStatic plugin prefix
 * @property {boolean} [mountMainAsRoot=false] - Whether to mount the main app as root or not
 * @property {Array<string>} [auth=['basic', 'apiKey', 'jwt']] - List of authentication methods to use
 * @property {Object} [cors={}] - CORS configuration
 * @property {Object} [helmet={}] - Helmet configuration
 * @property {boolean} [compress=false] - Whether to enable compression or not
 * @property {boolean} [rateLimit=false] - Whether to enable rate limiting or not
 * @property {Array<string>} [disabled=[]] - List of disabled features
 */
const config = {
  waibu: {
    prefix: 'asset'
  },
  waibuStatic: {
    prefix: 'static'
  },
  mountMainAsRoot: false,
  auth: ['basic', 'apiKey', 'jwt'],
  cors: {},
  helmet: {},
  compress: false,
  rateLimit: false,
  disabled: []
}

export default config
