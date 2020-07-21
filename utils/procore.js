// const { authorize, token, refresh } = require("@procore/js-sdk")
const { authorize } = require("@procore/js-sdk")

const clientId = process.env.PROCORE_CLIENT_ID
// const clientSecret = process.env.PROCORE_CLIENT_SECRET
const redirectUri = process.env.PROCORE_REDIRECT_URI

module.exports = {
  getAlbums() {
    authorize({ id: clientId, uri: redirectUri })
  },
}
