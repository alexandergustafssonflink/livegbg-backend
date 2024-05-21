async function getArtistInfo(artist) {
  const options = {
    method: "GET",
    url: "https://shazam.p.rapidapi.com/search",
    params: { term: artist, locale: "en-US", offset: "0", limit: "5" },
    headers: {
      "X-RapidAPI-Key": process.env.VUE_APP_SHAZAM_KEY,
      "X-RapidAPI-Host": "shazam.p.rapidapi.com",
    },
  };

  const { data } = await axios.request(options);
  if (
    data.artists?.hits[0].artist.name
      .split(" ")[0]
      .includes(artist.split(" ")[0])
  ) {
    return data;
  } else {
    if (artist.includes(" + ")) {
      const splittedArtist = artist.split(" + ")[0];
      const options = {
        method: "GET",
        url: "https://shazam.p.rapidapi.com/search",
        params: {
          term: splittedArtist,
          locale: "en-US",
          offset: "0",
          limit: "5",
        },
        headers: {
          "X-RapidAPI-Key": process.env.VUE_APP_SHAZAM_KEY,
          "X-RapidAPI-Host": "shazam.p.rapidapi.com",
        },
      };

      const { data } = await axios.request(options);
      if (data.artists) {
        if (
          data.artists.hits[0].artist.name
            .split(" ")[0]
            .includes(splittedArtist.split(" ")[0])
        ) {
          return data;
        }
      }
    } else if (artist.includes("#")) {
      const splittedArtist = artist.split("#")[0];
      const options = {
        method: "GET",
        url: "https://shazam.p.rapidapi.com/search",
        params: {
          term: splittedArtist,
          locale: "en-US",
          offset: "0",
          limit: "5",
        },
        headers: {
          "X-RapidAPI-Key": process.env.VUE_APP_SHAZAM_KEY,
          "X-RapidAPI-Host": "shazam.p.rapidapi.com",
        },
      };

      const { data } = await axios.request(options);
      if (data.artists) {
        if (
          data.artists.hits[0].artist.name
            .split(" ")[0]
            .includes(splittedArtist.split(" ")[0])
        ) {
          return data;
        }
      }
    } else if (artist.includes(" med ")) {
      const splittedArtist = artist.split(" med ")[0];
      const options = {
        method: "GET",
        url: "https://shazam.p.rapidapi.com/search",
        params: {
          term: splittedArtist,
          locale: "en-US",
          offset: "0",
          limit: "5",
        },
        headers: {
          "X-RapidAPI-Key": process.env.VUE_APP_SHAZAM_KEY,
          "X-RapidAPI-Host": "shazam.p.rapidapi.com",
        },
      };

      const { data } = await axios.request(options);
      if (data.artists) {
        if (
          data.artists.hits[0].artist.name
            .split(" ")[0]
            .includes(splittedArtist.split(" ")[0])
        ) {
          return data;
        }
      }
    } else if (artist.includes(" och ")) {
      const splittedArtist = artist.split(" och ")[0];
      const options = {
        method: "GET",
        url: "https://shazam.p.rapidapi.com/search",
        params: {
          term: splittedArtist,
          locale: "en-US",
          offset: "0",
          limit: "5",
        },
        headers: {
          "X-RapidAPI-Key": process.env.VUE_APP_SHAZAM_KEY,
          "X-RapidAPI-Host": "shazam.p.rapidapi.com",
        },
      };

      const { data } = await axios.request(options);
      if (data.artists) {
        if (
          data.artists.hits[0].artist.name
            .split(" ")[0]
            .includes(splittedArtist.split(" ")[0])
        ) {
          return data;
        }
      }
    } else if (artist.toLowerCase().includes("nytt datum")) {
      const splittedArtist = artist.toLowerCase().split("nytt datum")[1];
      const options = {
        method: "GET",
        url: "https://shazam.p.rapidapi.com/search",
        params: {
          term: splittedArtist,
          locale: "en-US",
          offset: "0",
          limit: "5",
        },
        headers: {
          "X-RapidAPI-Key": process.env.VUE_APP_SHAZAM_KEY,
          "X-RapidAPI-Host": "shazam.p.rapidapi.com",
        },
      };

      const { data } = await axios.request(options);
      console.log(data);
      if (data.artists) {
        if (
          data.artists.hits[0].artist.name
            .split(" ")[0]
            .includes(splittedArtist.split(" ")[0])
        ) {
          return data;
        }
      }
    } else if (artist.toLowerCase().includes("i salongen")) {
      const splittedArtist = artist.toLowerCase().split("i salongen")[0];
      const options = {
        method: "GET",
        url: "https://shazam.p.rapidapi.com/search",
        params: {
          term: splittedArtist,
          locale: "en-US",
          offset: "0",
          limit: "5",
        },
        headers: {
          "X-RapidAPI-Key": process.env.VUE_APP_SHAZAM_KEY,
          "X-RapidAPI-Host": "shazam.p.rapidapi.com",
        },
      };

      const { data } = await axios.request(options);
      console.log(data);
      if (data.artists) {
        if (
          data.artists.hits[0].artist.name
            .split(" ")[0]
            .includes(splittedArtist.split(" ")[0])
        ) {
          return data;
        }
      }
    }
  }
}

module.exports = getArtistInfo;
