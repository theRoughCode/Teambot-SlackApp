const async = require('async');

const MAX_MATCHES_DISPLAYED = 5;

// Gives a score on quality of match
function rateUser(userData, matchData, callback) {
  const userRoles = userData.roles || [];
  const userSkills = userData.skills || [];
  const matchRoles = matchData.roles || [];
  const matchSkills = matchData.skills || [];

  var rating = 0;
  // find matched roles
  async.forEachOf(userRoles, (role, index, next) => {
    // increase rating if match
    if (matchRoles.includes(role)) rating++;

    next();
  }, err => {
    if(err) return callback(null);

    // find matched skills
    async.forEachOf(userSkills, (skill, index, next) => {
      // increase rating if match
      if (matchSkills.includes(skill)) rating++;

      next();
    }, err => {
      if(err) return callback(null);
      else return callback(rating);
    });
  });
}

// Sort matches based on quality and timestamp
function sortMatches(matches, callback) {
  callback(matches.sort((x, y) => {
    // sort by rating in descending order, then by timestamp in ascending order
    return (y.rating - x.rating || x.ts - y.ts);
  }));
}


module.exports = {
  MAX_MATCHES_DISPLAYED,
  rateUser,
  sortMatches
}
