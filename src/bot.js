var Slack = require('slack-node');
const http = require('http');
const data = require('../src/data');

webhookUri = process.env.WEBHOOK;

var slack = new Slack();
slack.setWebhook(webhookUri);

const ROLES = ["Front End", "Back End", "Android", "iOS", "Design", "Hardware"];

// welcome message
function welcome(body, callback) {
  const userName = body.user_name;
  const userId = body.user_id;

  data.hasUser(userId, (res, data) => {
    // user exists in db
    if (res && data.visibility) {
      var actions = [];
      var action_userType = {
        "name": "user_type",
        "text": "",
        "type": "button",
        "value": ""
      };
      if(data.user_type === "team") {
        action_userType["text"] = "Find members instead";
        action_userType["value"] = "member";
      } else if (data.user_type === "member") {
        action_userType["text"] = "Find a team instead";
        action_userType["value"] = "team";
      }
      actions.push(action_userType);
      msg = {
        text: `Welcome back ${userName}! What would you like to do?`,
        attachments: [
          {
            "text": "Select an action:",
            "fallback": "The features of this app are not supported by your device",
            "callback_id": "edit",
            "color": "#3AA3E3",
            "attachment_type": "default",
            "actions": actions
          }
        ]
      };
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
      };
    }

    callback(msg);
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
    if(actions[0].name === 'done')
      setRoles(msg, actions[0].value, callback);
    else
      setRoles(msg, actions[0].selected_options[0].value, callback);
  } else if (callbackID === 'edit') {  // edit existing data
    if (actions[0].name === 'user_type') {
      editUserType(msg, actions[0].value, callback);
    }
  }
}

// display
function display(msg, callback) {
  const text = msg.text.toLowerCase();
  if(text === "members" || text === "member") { // display members
    data.getMembers((res, data) => {
      if(res) {
        if(data) callback(data);
        else callback("No members found. :disappointed:");
      } else callback();
    });
  } else if (text === "teams" || text === "team") { // display teams
    data.getTeams((res, data) => {
      if(res) {
        if(data) callback(data);
        else callback("No teams found. :disappointed:");
      } else callback();
    });
  } else {
    callback("Incorrect command.  e.g. _/display teams_");
  }
}

/* HELPERS */
function sendMsgToUrl(msg, url) {
  url = url.replace("\\","");
  var index = url.indexOf("hooks");
  url = url.substring(index);
  index = url.indexOf("/");
  const host = "www." + url.substring(0, index);
  const path = url.substring(index);
  var options = {
    host: host,
    path: path,
    port: '80',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  };

  function callback(res) {
    console.log('Status: ' + res.statusCode);
    console.log('Headers: ' + JSON.stringify(res.headers));
    res.setEncoding('utf8');
    res.on('data', function (body) {
      console.log('Body: ' + body);
    });
  }

  var req = http.request(options, callback);

  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });
  //This is the data we are posting, it needs to be a string or a buffer
  req.write(msg);
  req.end();
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
  const userName = msg.user.name;
  const userId = msg.user.id;
  var tempSlack = new Slack();

  tempSlack.setWebhook(responseUrl);
  var options = ROLES.map(role => {
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
    callback({
      text: ":mag_right: Looking for team members...",
      replace_original: true
    });
  }
  addUser(userId, userName, { userType: type }, success => {
    if(success) {}
    else {
      console.error(`Failed to add ${msg.user_name}`);
    }
  });
}

function editUserType(msg, type, callback) {
  const responseUrl = msg.response_url;
  const userName = msg.user.name;
  const userId = msg.user.id;
  var tempSlack = new Slack();

  tempSlack.setWebhook(responseUrl);
  var options = roles.map(role => {
    return {
      "text": `${role}`,
      "value": `${role}`
    };
  });
  var str = (type === "team") ? "a team" : "members";
  callback({
    text: `:pencil: You are now looking for ${str}.`,
    replace_original: true
  });
  addUser(userId, userName, { userType: type }, success => {
    if(success) {}
    else {
      console.error(`Failed to add ${msg.user_name}`);
    }
  });
}

function setRoles(msg, role, callback) {
  const url = msg.response_url;
  data.getRoles(msg.user.id, (res, roles) => {
    if(role === 'done') { // no more roles
      callback({
        text: "You are looking to fill: " + roles.join(", ") + "\n:mag_right: Commencing search...",
        replace_original: true
      });
      data.getTeams((res, data) => {
        if(res && data) sendMsgToUrl(data, url);
        else
          sendMsgToUrl("No members found. :disappointed:\nWould you like to bed discoverable by other teams?", url);
      })
    } else {
      if (roles === null) roles = [];
      roles.push(role);

      var options = ROLES.filter(role => {
        return !(roles.includes(role));
      }).map(role => {
        return {
          "text": `${role}`,
          "value": `${role}`
        };
      });

      var textStr = (roles.length)
        ? "You are currently looking to fill: " + roles.join(", ") + "\nAre you looking for any more roles to fill?"
        : "What roles are you looking to fill?";

      callback({
        text: textStr,
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
      data.updateRoles(msg.user.id, roles, success => {
        if (!success) console.error("ERROR: Could not update roles for " + msg.user.name);
      });
    }
  });
}


/* Interact with data.js */

function addUser(userId, userName, { roles = [], skills = {},
  userType = null, visible = false } = {}, callback) {
  if (userName === undefined) callback(false);
  data.updateUser(userId, {
    "username": userName,
    "roles": roles,
    "skills": skills,
    "user_type": userType,
    "visible": visible
  }, success => callback(success));
}

module.exports = {
  welcome,
  parseMsg,
  parseIMsg,
  display
}
