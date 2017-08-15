var Slack = require('slack-node');
const http = require('http');
const db = require('../src/data');
const async = require('async');

webhookUri = process.env.WEBHOOK;

const ROLES = [
  {
    role: "Front End",
    emote: ":computer:"
  },
  {
    role: "Back End",
    emote: ":floppy_disk:"
  },
  {
    role: "Android",
    emote: ":iphone:"
  },
  {
    role: "iOS",
    emote: ":apple:"
  },
  {
    role: "Design",
    emote: ":art:"
  },
  {
    role: "Hardware",
    emote: ":wrench:"
  }
];

// welcome message
function welcome(body, callback) {
  const userName = body.user_name;
  const userId = body.user_id;

  db.hasUser(userId, (res, data) => {
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
    setRoles(msg, actions[0].value, callback);
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

// Lists teams or members
function list(msg, callback) {
  const responseUrl = msg.response_url;
  const text = msg.text.toLowerCase();

  var output = function (type, res, data) {
    if(!res) return displayErrorMsg(msg => callback({ text: msg }));
    else if (!data) return callback(`No ${type}s found. :disappointed:`);

    const attachments = [];
    callback(null);

    async.forEachOf(data, (value, userId, innerCallback) => {
      db.getUserInfo(userId, (success, info) => {
        if (success) {
          const roles = (info.roles) ? info.roles.join(", ") : "N/A";
          const skills = (info.skills) ? info.skills.join(", ") : "N/A";
          const userName = info.username;

          // if valid username
          if(userName) {
            attachments.push({
              "fallback": "Required plain-text summary of the attachment.",
              "color": "#3AA3E3",
              "title": `<@${userId}|${userName}>`,
              "fields": [
                {
                  "title": "Roles",
                  "value": roles,
                  "short": true
                },
                {
                  "title": "Skills",
                  "value": skills,
                  "short": true
                }
              ]
            });
          }
          innerCallback();
        } else {
          return displayErrorMsg(msg => sendMsgToUrl({ text: msg }, responseUrl));
        }
      });
    }, function (err) {
      if (err) {
        console.error(err.message);
        return displayErrorMsg(msg => sendMsgToUrl({ text: msg }, responseUrl));
      } else {
        return sendMsgToUrl({
         "text": `List of ${type}s:`,
         attachments: attachments
       }, responseUrl);
      }
    });
  };

  if(text === "members" || text === "member") { // display members
    db.getMembers((res, data) => output("member", res, data));
  } else if (text === "teams" || text === "team") { // display teams
    db.getTeams((res, data) => output("team", res, data));
  } else {
    callback("Incorrect command.  e.g. _/list teams_");
  }
}

// display user info
function display(userId, callback) {
  db.getUserInfo(userId, (res, data) => {
    if (res) {
      const roles = (data.roles) ? data.roles.join(", ") : "N/A";
      const skills = (data.skills) ? data.skills.join(", ") : "N/A";
      const userType = (data.user_type) ? data.user_type.substring(0, 1).toUpperCase() + data.user_type.substring(1) : "N/A";
      const userName = data.username || "N/A";
      const visible = (data.visible) ? "Yes" : "No";
      callback({
        attachments: [
          {
              "fallback": "Required plain-text summary of the attachment.",
              "color": "#3AA3E3",
              "pretext": "Here are your preferences!",
              "fields": [
                  {
                      "title": "Roles",
                      "value": roles,
                      "short": true
                  },
                  {
                      "title": "Skills",
                      "value": skills,
                      "short": true
                  },
                  {
                      "title": "Looking For",
                      "value": userType,
                      "short": true
                  },
                  {
                      "title": "Discoverable?",
                      "value": visible,
                      "short": true
                  }
              ]
          }
        ]
      });
    } else displayErrorMsg(msg => callback({ text: msg }));
  })
}

// Update skills
function updateSkills(msg, callback) {
  const responseUrl = msg.response_url;

  if (!msg.text) return callback({
    text: "Incorrect command. Please input skills!"
  });
  var text = msg.text.replace(/\s/g,'');
  var skills = text.split(',');

  db.updateSkills(msg.user_id, skills, success => {
    if (success) {
      callback(null);
      async.map(skills, (skill, next1) => {
        next1(null, async.times(5, (n, next2) => {
          next2(null, {
            "name": `${skill}`,
            "text": ":star:".repeat(n),
            "type": "button",
            "value": n
          });
        }, (err, actions) => {
          return {
            "fallback": "The features of this app are not supported by your device",
            "callback_id": "skills",
            "color": "#3AA3E3",
            "attachment_type": "default",
            "title": `${skill}`,
            "actions": actions
          };
        }));
      }, (err, attachments) => {
        return sendMsgToUrl({
          text: "Here are your skills: " + skills.join(", ") + "\nHow proficient are you at:",
          attachments: attachments
        }, responseUrl);
      });
    } else displayErrorMsg(msg => callback({ text: msg }));
  });
}

/* HELPERS */

// send message to webhook
function sendMsgToUrl(msg, url = webhookUri) {
  var slack = new Slack();
  slack.setWebhook(url);

  slack.webhook(msg, function(err, response) {});
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
  var attachments = ROLES.map(role => {
    return {
      "text": `${role.emote} ${role.role}`,
      "fallback": "The features of this app are not supported by your device",
      "callback_id": "roles",
      "color": "#3AA3E3",
      "attachment_type": "default",
      "actions": [
          {
              "name": `${type}`,
              "text": "Add to roles",
              "type": "button",
              "value": `${role.role}`
          }
        ]
    };
  });
  attachments.push({
    "text": ":thumbsup: That's all!",
    "fallback": "The features of this app are not supported by your device",
    "callback_id": "roles",
    "color": "#3AA3E3",
    "attachment_type": "default",
    "actions": [
        {
            "name": `${type}`,
            "text": "Begin search",
            "type": "button",
            "value": "done"
        }
      ]
  });

  // looking for team
  if(type === "team") {
    callback({
      text: `Awesome!  Before we begin our search, tell us more about you!\nWhat roles are you looking to fill?`,
      replace_original: true,
      attachments: attachments
    });
  }
  // looking for members
  else {
    callback({
      text: `Awesome!  Before we begin our search, tell us more about your team!\nWhat roles are you looking for?`,
      replace_original: true,
      attachments: attachments
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

  db.updateType(userId, type, success => {
    if(success) {
      var isTeam = (type !== "team");
      var str = !isTeam ? "a team" : "members";
      db.updateTeam(userId, success => {
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
      db.updateMember(userId, success => {
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
  const type = msg.actions[0].name;

  var output = function(res, data) {
    if(res && data) sendMsgToUrl({ text: data }, url);
    else {
      text = `No ${type}s found. :disappointed:\nWould you like to be discoverable by other ${type}s?`;
      sendMsgToUrl({
        text: text,
        attachments: [
            {
                "fallback": "The features of this app are not supported by your device",
                "callback_id": `discover_${type}`,
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
  }

  var parseRoles = function(roles) {
    if (roles === null) roles = [];
    roles.push(role);  // add role to list

    var attachments = ROLES.map(role => {
      if (roles.includes(role.role))
        return {
          "text": `:white_check_mark: Added ${role.role} to your roles!`,
          "fallback": "The features of this app are not supported by your device",
          "color": "#3AA3E3",
          "attachment_type": "default"
        };
      else
        return {
          "text": `${role.emote} ${role.role}`,
          "fallback": "The features of this app are not supported by your device",
          "callback_id": "roles",
          "color": "#3AA3E3",
          "attachment_type": "default",
          "actions": [
            {
              "name": `${type}`,
              "text": "Add to roles",
              "type": "button",
              "value": `${role.role}`
            }
          ]
        };
    });
    attachments.push({
      "text": ":thumbsup: That's all",
      "fallback": "The features of this app are not supported by your device",
      "callback_id": "roles",
      "color": "#3AA3E3",
      "attachment_type": "default",
      "actions": [
        {
          "name": `${type}`,
          "text": "Begin search",
          "type": "button",
          "value": "done"
        }
      ]
    });

    db.updateRoles(msg.user.id, roles, success => {
      if (success) {
        callback({
          text: `Awesome!  Before we begin our search, tell us more about you!\nWhat roles are you looking to fill?`,
          replace_original: true,
          attachments: attachments
        });
      }
      else {
        console.error("ERROR: Could not update roles for " + msg.user.name);
        displayErrorMsg(msg => callback({ text: msg }));
      }
    });
  }

  db.getRoles(msg.user.id, (res, roles) => {
    if(role === 'done') { // no more roles
      callback({
        text: "You are looking to fill: " + roles.join(", ") + "\n:mag_right: Commencing search...",
        replace_original: true
      });
      if(type === "teams") db.getTeams(output);
      else db.getMembers(output);
    } else parseRoles(roles);
  });
}

function setDiscoverable(msg, discoverable, category, callback) {
  if (discoverable === "true") {
    db.updateVisibility(msg.user.id, true, success => {
      if(success)
        callback(":thumbsup: Awesome!  You are now discoverable to others and will be notified if they would like to team up!\nTo allow others to have more information, you can list down all relevant skills (i.e. languages/frameworks/tools) using the `/skills` command!\ne.g. `/skills Node.js, Python, Java`");
      else {
        console.error("ERROR: Could not update visibility of " + msg.user.name);
        return displayErrorMsg(callback);
      }
    });
    if (category === "member") { // member looking for teams
      db.updateMember(msg.user.id, () => {});
    } else if (category === "team") {  // team looking for members
      db.updateTeam(msg.user.id, () => {});
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
  db.updateUser(userId, {
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
  list,
  display,
  updateSkills
}
