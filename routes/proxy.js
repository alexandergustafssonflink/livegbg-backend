const router = require("express").Router();
const request = require("request");

router.get("/", (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).send("Bad Request: URL parameter is missing.");
  }

  request({ url: imageUrl, encoding: null }, (error, response, body) => {
    if (error) {
      return res.status(500).send("Error fetching the image.");
    }

    res.setHeader("Content-Type", "image/jpeg");
    res.send(body);
  });
});

module.exports = router;
