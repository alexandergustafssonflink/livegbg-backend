const router = require("express").Router();
const Artist = require("../models/artist.js");

// router.post("/", async (req, res) => {
//     console.log(req.body.name);
//     try {
//         const artist = await Artist.find({name: req.body.name})
//         console.log(artist)
//         res.json(artist)
//     } catch (error) {
//         res.send(error)
//     }
// })

router.get("/", async (req, res) => {
    try {
        const artist = await Artist.find({name: req.query.artist})
        res.json(artist)
    } catch (error) {
        res.send(error)
    }
})



module.exports = router;