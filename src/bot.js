var Slack = require('slack-node');
const http = require('http');
const data = require('../src/data');

webhookUri = process.env.WEBHOOK;

const ROLES = ["Front End", "Back End", "Android", "iOS", "Design", "Hardware"];

// welcome message
function welcome(body, callback) {
  const userName = body.user_name;
  const userId = body.user_id;

  data.hasUser(userId, (res, data) => {
    // user exists in db
    if (res && data.visible) {
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
    sendMsgToUrl({ text: message });
}

// list commands
function helpMsg() {
  sendMsgToUrl({ text: "Type /start to begin the search!" });
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
  } else if (callbackID === 'discover_team') { // find teams
    setDiscoverable(msg, actions[0].value, "member", callback);
  } else if (callbackID === 'discover_member') {  // find members
    setDiscoverable(msg, actions[0].value, "team", callback);
  } else if (callbackID === 'edit') {  // edit existing data
    if (actions[0].name === 'user_type') {
      editUserType(msg, actions[0].value, callback);
    }
  }
}

// Display teams or members
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

// Update skills
function updateSkills(msg, callback) {
  var text = msg.text.replace(/\s/g,'');
  var skills = text.split(',');
  if(!skills.length) return callback({
    text: "Please input skills"
  });
  data.updateSkills(msg.user_id, skills, success => {
    if (success) {
      callback({
        text: "Here are your skills: " + skills.join(", ")
      });
    } else displayErrorMsg(msg => callback({ text: msg }));
  });
}

/* HELPERS */

// send message to webhook
function sendMsgToUrl(msg, url = webhookUri) {
  var slack = new Slack();
  slack.setWebhook(url);

  slack.webhook(msg, function(err, response) {
    console.log(response);
  });
}

// display error message
function displayErrorMsg(callback) {
  callback("Oops, something went wrong! :thinking-face:\nPlease contact an organizer! :telephone_receiver:");
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

  data.updateType(userId, type, success => {
    if(success) {
      var isTeam = (type !== "team");
      var str = !isTeam ? "a team" : "members";
      data.updateTeam(userId, success => {
        if(success) {
          callback({
            text: `:pencil: You are now looking for ${str}.`,
            replace_original: true
          });
        } else {
          displayErrorMsg(msg => {
            return callback({
              text: msg,
              replace_original: true
            });
          });
        }
      }, !isTeam);
      data.updateMember(userId, success => {
        if(success) {
          callback({
            text: `:pencil: You are now looking for ${str}.`,
            replace_original: true
          });
        } else {
          displayErrorMsg(msg => {
            return callback({
              text: msg,
              replace_original: true
            });
          });
        }
      }, isTeam);
    }
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
        if(res && data) sendMsgToUrl({ text: data }, url);
        else {
          text = "No teams found. :disappointed:\nWould you like to be discoverable by other teams?";
          sendMsgToUrl({
            text: text,
            attachments: [
                {
                    "fallback": "The features of this app are not supported by your device",
                    "callback_id": "discover_team",
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "actions": [
                        {
                          "name": "yes",
                          "text": "Yes please!",
                          "type": "button",
                          "value": "true"
                        },
                        {
                          "name": "no",
                          "text": "No, it's ok!",
                          "type": "button",
                          "value": "false"
                        }
                    ]
                }
            ]
          }, url);
        }
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

function setDiscoverable(msg, discoverable, category, callback) {
  if (discoverable === "true") {
    data.updateVisibility(msg.user.id, true, success => {
      if(success)
        callback(":thumbsup: Awesome!  You are now discoverable to others and will be notified if they would like to team up!\nTo allow others to have more information, you can list down all relevant skills(i.e. languages/frameworks/tools) using the `/skills` command!\ne.g. /skills Node.js, Python, Java");
      else {
        console.error("ERROR: Could not update visibility of " + msg.user.name);
        return displayErrorMsg(callback);
      }
    });
    if (category === "member") { // member looking for teams
      data.updateMember(msg.user.id, () => {});
    } else if (category === "team") {  // team looking for members
      data.updateTeam(msg.user.id, () => {});
    }
  }
  else {
    callback("All the best team-hunting! :smile:");
  }
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
  display,
  updateSkills
}
