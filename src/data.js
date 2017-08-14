var admin = require("firebase-admin");

var serviceAccount = require("./teambot-68704-firebase-adminsdk-inu4i-8189c53812.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://teambot-68704.firebaseio.com"
});

var auth = admin.auth();
var db = admin.database();
var userRef = db.ref('users');

// Add user to database
function updateUser(userId, data, callback) {
  /*
  Keyword Arguments:
    username -- user's username as a string
    roles -- list of interested roles
    skills -- list of skills and their level from 1 to 5 as an integer
    user_type -- indicates whether looking for a "team" or "member"
    visible -- true if user is visible for search
  */
  userRef.child(userId).set(data).then(() => {
    callback(true);
  }, error => {
    console.error(error);
    callback(false);
  });
}

// Update field
function updateField(userId, field, data, callback) {
  userRef.child(userId + `/${field}`).set(data).then(() => {
    callback(true);
  }, error => {
    console.error(error);
    callback(false);
  });
}

// Returns true if user is in database
function hasUser(userId, callback) {
  userRef.once('value').then(snapshot => {
    if (snapshot.val()) callback(snapshot.hasChild(userId), snapshot.val()[userId]);
    else callback(false, null);
  });
}

// Delete user
function deleteUser (userId) {
  userRef.child(userId).remove();
}

module.exports = {
  updateUser,
  updateField,
  hasUser,
  deleteUser
}
