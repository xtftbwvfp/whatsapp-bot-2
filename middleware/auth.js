const jwt = require("jsonwebtoken")

module.exports = {
  authenticateToken(req, res, next) {
    if (req.path == "/auth") return next()
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]
    if (token == null) return res.sendStatus(401)

    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
      if (err) return res.status(403).send({ message: err.name })
      req.user = user
      next()
    })
  },
  generateAccessToken(username) {
    return jwt.sign(username, process.env.TOKEN_SECRET, { expiresIn: "1800s" })
  },
}
