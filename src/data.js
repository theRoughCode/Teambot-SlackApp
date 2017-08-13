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
  userRef.child(userId).set(data).then(() => {
    callback(true);
  }, error => {
    console.error(error);
    callback(false);
  });
}

// returns true if user is in database
function hasUser(userId, callback) {
  userRef.once('value', snapshot => {
    callback(snapshot.hasChild(userId));
  })
}

// Delete user
function deleteUser (userId) {
  userRef.child(userId).remove();
}

module.exports = {
  updateUser,
  hasUser,
  deleteUser
}
