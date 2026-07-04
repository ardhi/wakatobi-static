const boot = {
  level: 10,
  handler: async function boot (prefix) {
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

export default boot
