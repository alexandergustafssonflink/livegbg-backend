function filterOutNonMusic(events) {
  let filtered = events.filter(
    (event) =>
      !event.title.toLowerCase().includes("wrestl") &&
      !event.title.toLowerCase().includes("forskare") &&
      !event.title.toLowerCase().includes("danscentrum") &&
      !event.title.toLowerCase().includes("poesi")
  );
  return filtered;
}

module.exports = filterOutNonMusic;
