// const router = require("express").Router();
// const request = require("request");

// router.get("/", (req, res) => {
//   const imageUrl = req.query.url;
//   if (!imageUrl) {
//     return res.status(400).send("Bad Request: URL parameter is missing.");
//   }

//   // Skicka förfrågan till den faktiska bildens URL
//   request({ url: imageUrl, encoding: null }, (error, response, body) => {
//     if (error) {
//       return res.status(500).send("Error fetching the image.");
//     }
//     // Skicka rätt content-type
//     res.setHeader("Content-Type", "image/jpeg"); // Du kan behöva justera detta baserat på bildens MIME-typ
//     res.send(body);
//   });
// });

// module.exports = router;
