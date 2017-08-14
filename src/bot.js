var Slack = require('slack-node');
const data = require('../src/data');

webhookUri = process.env.WEBHOOK;

var slack = new Slack();
slack.setWebhook(webhookUri);

const roles = ["Front End", "Back End", "Android", "iOS", "Design", "Hardware"];

// welcome message
function welcome(body) {
  const userName = body.user_name;
  const userId = body.user_id;

  data.hasUser(userId, res => {
    // user exists in db
    if (res) {
      msg = {
        text: `Welcome back ${userName}!`
      }
    }
    else { // user does not exist
      msg = {
        text: `Hi ${userName}!  I'm here to assist you with forming a team!\nTo start, are you looking to join a team or are you part of a team looking for team members?`,
        attachments: [
            {
                "text": "I am looking for:",
                "fallback": "The features of this app are not supported by your device",
                "callback_id": "user_type",
                "color": "#3AA3E3",
                "attachment_type": "default",
                "actions": [
                    {
                        "name": "user_team",
                        "text": "A Team",
                        "type": "button",
                        "value": "team"
                    },
                    {
                        "name": "user_member",
                        "text": "Team Members",
                        "type": "button",
                        "value": "member"
                    }
                ]
            }
        ]
      }
    }

    slack.webhook(msg, function(err, response) {
      console.log(response);
    });
  });

}

// send message
function parseMsg(message) {
  if (message === "help") helpMsg();
  else
    slack.webhook({
      text: message
    }, function(err, response) {
      console.log(response);
    });
}

// list commands
function helpMsg() {
  slack.webhook({
    text: "Type /start to begin the search!"
  }, function(err, response) {
    console.log(response);
  });
}

// parse interactive messages
function parseIMsg(msg, callback) {
  msg = JSON.parse(msg.payload);
  const callbackID = msg.callback_id;
  const actions = msg.actions;

  if (callbackID === 'user_type') {
    setUserType(msg, actions[0].value, callback);
  } else if (callbackID === 'roles') {
    
  }
}


/*   Interactive Message Handlers */
/* Format:
{
  token, team_id, team_domain, channel_id
  channel_name, user_id, user_name,
  command=/ , text, response_url
}*/

function setUserType(msg, type, callback) {
  const responseUrl = msg.response_url;
  var tempSlack = new Slack();
  tempSlack.setWebhook(responseUrl);
  var options = roles.map(role => {
    return {
      "text": `${role}`,
      "value": `${role}`
    };
  });

  // looking for team
  if(type === "team") {
    callback({
      text: `Awesome!  Before we begin our search, tell us more about you!\nWhat roles are you looking to fill?`,
      replace_original: true,
      attachments: [
          {
              "text": "Select your roles:",
              "fallback": "The features of this app are not supported by your device",
              "callback_id": "roles",
              "color": "#3AA3E3",
              "attachment_type": "default",
              "actions": [
                  {
                      "name": "roles_list",
                      "text": "Pick a role...",
                      "type": "select",
                      "options": options
                  },
                  {
                    "name": "done",
                    "text": "No more roles",
                    "type": "button",
                    "value": "done"
                  }
              ]
          }
      ]
    });
  }
  // looking for members
  else {
    callback(":mag_right: Looking for team members...");
  }
  addUser(msg.user_id, msg.user_name, { userType: type }, success => {});
}


/* Interact with data.js */

function addUser(userId, userName, { roles = [], skills = {},
  userType = null, temp = true } = {}, callback) {
  data.updateUser(userId, {
    "username": userName,
    "roles": roles,
    "skills": skills,
    "user_type": userType,
    "temp": temp
  }, success => callback(success));
}

function updateRoles(userId, roles, callback) {
  data.updateField(userId, "roles", roles, success => callback(success));
}

function updateSkills(userId, skills, callback) {
  data.updateField(userId, "skills", skills, success => callback(success));
}

function updateUserType(userId, type, callback) {
  data.updateField(userId, "user_type", type, success => callback(success));
}

function updateTemp(userId, temp, callback) {
  data.updateField(userId, "temp", temp, success => callback(success));
}

module.exports = {
  welcome,
  parseMsg,
  parseIMsg
}
