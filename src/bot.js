var Slack = require('slack-node');
const http = require('http');
const db = require('../src/data');
const match = require('../src/match');
const format = require('../src/format');
const async = require('async');

webhookUri = process.env.WEBHOOK;
token = process.env.API_TOKEN;
const SLACK = new Slack(token);

const BOT_CHANNEL = "bots";

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
  const responseUrl = body.response_url;
  callback(null);

  db.hasUser(userId, (res, data) => {
    // user exists in db
    if (res) return format.welcomeOldUser(userName, userId, data, msg => sendMsgToUrl(msg, responseUrl));
    // user does not exist
    else return format.welcomeNewUser(userName, msg => sendMsgToUrl(msg, responseUrl));
  });
}

// welcome new user
function welcomeUser(userId, channel, callback) {
  callback(null);

  if (channel !== BOT_CHANNEL) return;

  convertToUserName(userId, data => {
    if (data)
      return sendMsgToUrl({
        "channel": `#${BOT_CHANNEL}`,
        "username": data,
        "text": `:wave: Welcome ${data}!\n` + "Type `/start` to begin searching or `/help` for a list of commands!"
      });
  });
}

// list commands
function helpMsg(callback) {
  callback({ text: "List of commands:\n  `/start` to begin the search!\n  `/display` to display your preferences\n  `/list (members/teams)` to display the list of discoverable users" });
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
  } else if (callbackID === 'skills') {
    updateSkillLevels(msg, actions[0].name, actions[0].value, callback);
  } else if (callbackID === 'discover_team') { // find teams
    setDiscoverable(msg, actions[0].value, "team", callback);
  } else if (callbackID === 'discover_member') {  // find members
    setDiscoverable(msg, actions[0].value, "member", callback);
  } else if (callbackID === 'edit') {  // edit existing data
    // change user type
    if (actions[0].name === 'user_type') {
      editUserType(msg, actions[0].value, callback);
    }
    // turn on visibility
    else if (actions[0].name === "visibility") {
      setDiscoverable(msg, "true", actions[0].value, callback);
    }
    // remove user
    else if (actions[0].name === "remove") {
      removeUser(msg.user.id, callback);
    }
  }
}

// parse incoming events
function parseEvent(msg, callback) {
  if (msg.event.type === "url_verification")
    verifyURL(msg.challenge, callback);
  else if (msg.event.type === "member_joined_channel")
    welcomeUser(msg.event.user, msg.event.channel, callback);
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
          const skills = (info.skills) ? info.skills.map(skill => {
            if(skill.level) return `${skill.skill} (Level: ${skill.level})`;
            else return `${skill.skill}`;
          }).join(", ") : "N/A";
          const userName = info.username;

          // if valid username
          if(userName) format.formatUser(obj => attachments.push(obj));
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
      const skills = (data.skills) ? data.skills.map(skill => {
        if(skill.level) return `${skill.skill} (Level: ${skill.level})`;
        else return `${skill.skill}`;
      }).join(", ") : "N/A";
      const userType = (data.user_type) ? data.user_type.substring(0, 1).toUpperCase() + data.user_type.substring(1) : "N/A";
      const userName = data.username || "N/A";
      const visible = (data.visible) ? "Yes" : "No";

      // format display
      format.formatInfo(obj => callback({ "attachments" : [obj] }));

    } else displayErrorMsg(msg => callback({ text: msg }));
  })
}

// Create new skills
function createSkills(msg, callback) {
  const responseUrl = msg.response_url;

  if (!msg.text) return callback({
    text: "Incorrect command. Please input skills!"
  });
  var text = msg.text.replace(/\s/g,'');
  var skills = text.split(',');

  // Remove duplicates
  var tempObj = {};
  for (var i = 0; i < skills.length; i++) {
    // store index of elements (case-insensitive)
    const skill = skills[i].toLowerCase();
    if (!tempObj[skill]) tempObj[skill] = [i];
    else tempObj[skill].push(i);
  }

  for (let skill in tempObj) {
    const indexArr = tempObj[skill];
    if (indexArr.length > 1) {
      for (var i = 1; i < indexArr.length; i++) {
        skills.splice(indexArr[i], 1);  // remove duplicate at that index
      }
    }
  }

  callback(null);
  displaySkillChoice(skills, res => {
    sendMsgToUrl(res, responseUrl);
    var skillArr = skills.filter((skill, index, self) => {
      return index === self.indexOf(skill);  // remove duplicates
    }).map(skill => {
      return {
        skill: skill,
        level: null
      };
    });
    db.updateSkills(msg.user_id, skillArr, success => {
      if (!success) displayErrorMsg(res => sendMsgToUrl({ text: res }, responseUrl));
    });
  });
}

/* HELPERS */

// send message to webhook
function sendMsgToUrl(msg, url = webhookUri) {
  var slack = new Slack();
  slack.setWebhook(url);

  slack.webhook(msg, function(err, response) {});
}

// display skills
function displaySkillChoice(skills, callback) {
  if(!skills.length) return callback({
    text: ":thumbsup: Excellent! Your skill levels are all set!"
  });

  async.map(skills, (skill, next1) => {
    async.times(5, (n, next2) => {
      next2(null, {
        "name": `${skill}`,
        "text": ":star:".repeat(n + 1),
        "type": "button",
        "value": n + 1
      });
    }, (err, actions) => {
      format.formatSkillLvl(obj => next1(null, obj));
    });
  }, (err, attachments) => {
    callback({
      text: "How proficient are you at:",
      attachments: attachments
    });
  });
}

// Convert from username to id
function convertToUserID(userName, callback){
  // Send either a U123456 UserID or bob UserName and it will return the U123456 value all the time
  SLACK.api("users.list", function(err, response) {
    if (response.error) format.displayErrorMsg(`Failed to convert username of ${userName} to id: Database error`, msg => callback(false, { text: msg }));
    for (var i = 0; i < response.members.length; i++) {
      if(response.members[i].id === userId || response.members[i].name === userId){
        return callback(true, response.members[i].id);
      }
      if (i === response.members.length) format.displayErrorMsg("Failed to convert username to id: User could not be found", msg => callback(false, { text: msg }));
    }
  });
}

// convert from id to username
function convertToUserName(userId, callback){
  // Send either a U123456 UserID or bob UserName and it will return the bob value all the time
  SLACK.api("users.list", function(err, response) {
    if (response.error) format.displayErrorMsg(`Failed to convert id of ${userId} to username: Database error`, msg => callback({ text: msg }));
    for (var i = 0; i < response.members.length; i++) {
      if(response.members[i].id === userId || response.members[i].name === userId){
        return callback(response.members[i].name);
      }
      if (i === response.members.length) format.displayErrorMsg("Failed to convert username to id: User could not be found", msg => callback({ text: msg }));
    }
  });
}

// Role selection
function selectRoles(roles, callback, defaultButton = null) {
  async.map(ROLES, (role, next) => {
    if (roles.includes(role.role))
      return next(null, {
        "text": `:white_check_mark: Added ${role.role} to your roles!`,
        "fallback": "The features of this app are not supported by your device",
        "color": "#3AA3E3",
        "attachment_type": "default"
      });
    else
      return next(null, {
        "text": `${role.emote} ${role.role}`,
        "fallback": "The features of this app are not supported by your device",
        "callback_id": "roles",
        "color": "#3AA3E3",
        "attachment_type": "default",
        "actions": [
          {
            "name": "roles",
            "text": "Add to roles",
            "type": "button",
            "value": `${role.role}`
          }
        ]
      });
  }, (err, results) => {
    if(defaultButton) results.push(defaultButton);
    return callback(results);
  });
}


/*  Event Handlers */

// handle url verification to Events API
function verifyURL(challenge, callback) {
  callback({
    "challenge": challenge
  });
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

  selectRoles([], attachments => {
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
  }, {
    "text": ":thumbsup: That's all!",
    "fallback": "The features of this app are not supported by your device",
    "callback_id": "roles",
    "color": "#3AA3E3",
    "attachment_type": "default",
    "actions": [
        {
            "name": "done",
            "text": "Begin search",
            "type": "button",
            "value": "done"
        }
      ]
  });

  addUser(userId, userName, { userType: type }, success => {
    if (!success) {
      format.displayErrorMsg(`Failed to add ${msg.user_name}`, msg => sendMsgToUrl(msg, responseUrl));
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
          format.displayErrorMsg("Failed to update team", msg => {
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
          format.displayErrorMsg("Failed to update member", msg => {
            return callback({
              text: msg,
              replace_original: true
            });
          });
        }
      }, isTeam);
    }
    else {
      format.displayErrorMsg(`Failed to update user type of ${msg.user_name}`, msg => {
        return callback({
          text: msg,
          replace_original: true
        });
      });
    }
  });
}

function setRoles(msg, role, callback) {
  const responseUrl = msg.response_url;

  callback(null);

  db.getUserInfo(msg.user.id, (res, userData) => {
    if (!res) return format.displayErrorMsg(`Could not get ${msg.user.name}'s info: Database error`, msg => sendMsgToUrl(msg, responseUrl));

    const type = userData.user_type;
    var roles = userData.roles;

    // errors is handled by parseRoles(null)
    if (role === 'done') { // no more role
      sendMsgToUrl({
        text: "You are looking to fill: " + roles.join(", ") + "\n:mag_right: Commencing search...",
        replace_original: true
      }, responseUrl);

      const noMatchMsg = {
        text: `No ${type}s found. :disappointed:\nWould you like to be discoverable by other ${type}s?`,
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
      };

      var handleMatches = function(res, data) {
        if (!res) return format.displayErrorMsg(`${msg.user.name}'s team could not be retrieved: Database error`, msg => sendMsgToUrl(msg, responseUrl));
        else if (data) findMatch(userData, data, matches => {
          if (!matches || !matches.length) return sendMsgToUrl(noMatchMsg, responseUrl);
          else return format.formatMatches(matches, formatted => sendMsgToUrl(formatted, responseUrl));
        });
        else return sendMsgToUrl(noMatchMsg, responseUrl);
      }

      // Perform matchmaking
      if (type === "team") db.getTeams(handleMatches);
      else db.getMembers(handleMatches);

    } else {
      if (!roles) roles = [];
      roles.push(role);  // add role to list

      selectRoles(roles, attachments => {
        db.updateRoles(msg.user.id, roles, success => {
          if (success) {
            sendMsgToUrl({
              "text": `Awesome!  Before we begin our search, tell us more about you!\nWhat roles are you looking to fill?`,
              "replace_original": true,
              "attachments": attachments,
              "response_type": "ephemeral"
            }, responseUrl);
          }
          else {
            format.displayErrorMsg(`ERROR: Could not update roles for ${msg.user.name}`, msg => sendMsgToUrl({ text: msg }, responseUrl));
          }
        });
      },
      // Default Button
      {
        "text": ":thumbsup: That's all",
        "fallback": "The features of this app are not supported by your device",
        "callback_id": "roles",
        "color": "#3AA3E3",
        "attachment_type": "default",
        "actions": [
          {
            "name": "done",
            "text": "Begin search",
            "type": "button",
            "value": "done"
          }
        ]
      });
    }
  });
}

// Return array of matches
/*
[{ "user_id","user_name","rating","roles","skills","ts" }]
*/
function findMatch(userData, matchArr, callback) {
    const matches = [];

    async.forEachOf(matchArr, (ts, matchId, next) => {
      db.getUserInfo(matchId, (res, matchData) => {
        match.rateUser(userData, matchData, rating => {
          if(rating) matches.push({
            "user_id": matchId,
            "user_name": matchData.username,
            "rating": rating,
            "roles": matchData.roles,
            "skills": matchData.skills,
            "ts": ts
          });
          next();
        });
      });
    }, err => {
      if (err) return callback(null);
      else match.sortMatches(matches, sorted => {
        return callback(sorted);
      });
    });
}

// Update Skill Levels
function updateSkillLevels(msg, skill, level, callback) {
  const responseUrl = msg.response_url;
  const skillArr = [];
  const userId = msg.user.id;

  db.getSkills(userId, (res, skills) => {
    if (!res) return format.displayErrorMsg(`Could not retrieve skills for ${userId}: Database error`, msg => callback({ text: msg }));

    callback(null);

    for (var i = 0; i < skills.length; i++) {
      if(skills[i].skill === skill) {
        skills[i]["level"] = level;
        db.updateSkills(userId, skills, success => {
          async.forEachOf(skills, (value, index, next) => {
            if (!value.level) skillArr.push(value.skill);
            next();
          }, err => {
            if (err) return format.displayErrorMsg(`Could not update skills for ${userId}: Database error`, msg => sendMsgToUrl({ text: msg }, responseUrl));
            displaySkillChoice(skillArr, msg => sendMsgToUrl(msg, responseUrl));
          });
        });
      }
    }
  })
}

function setDiscoverable(msg, discoverable, category, callback) {
  if (discoverable === "true") {
    db.updateVisibility(msg.user.id, true, success => {
      if(success) {
        var text = (category === "team") ? "all relevant skills" : "the skills you're looking for"
        callback(`:clap: Yay!  You are now discoverable to others and will be notified if they would like to team up!\nTo allow others to have more information, you can list down ${text} (i.e. languages/frameworks/tools) using the ` + "`/skills` command!\ne.g. `/skills Node.js, Python, Java`");
      }
      else {
        return format.displayErrorMsg(`Could not update visibility of ${msg.user.name}`, callback);
      }
    });
    if (category === "team") { // member looking for teams
      db.updateMember(msg.user.id, success => {
        if (!success) return format.displayErrorMsg(`Could not add ${msg.user.name} into Member database`, callback);
      });
    } else if (category === "member") {  // team looking for members
      db.updateTeam(msg.user.id,  success => {
        if (!success) return format.displayErrorMsg(`Could not add ${msg.user.name} into Team database`, callback);
      });
    }
  }
  else {
    callback("All the best team-hunting! :smile:");
  }
}


/* Interact with data.js */

function addUser(userId, userName, { roles = [], skills = [],
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

// remove user
function removeUser(userId, callback) {
  db.deleteUser(userId, success => {
    if (success) callback({
      "text": ":thumbsup: You've been successfully removed!  Happy hacking! :smiley:"
    });
    else format.displayErrorMsg(`Could not remove ${userId} from database`, msg => callback({ text: msg }));
  });
}

module.exports = {
  welcome,
  helpMsg,
  parseIMsg,
  parseEvent,
  list,
  display,
  createSkills
}
