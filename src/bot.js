var Slack = require('slack-node');
const http = require('http');
const db = require('../src/data');
const match = require('../src/match');
const format = require('../src/format');
const async = require('async');

webhookUri = process.env.WEBHOOK;
token = process.env.API_TOKEN;
const SLACK = new Slack(token);

const BOT_CHANNEL_NAME = process.env.BOT_CHANNEL_NAME;
const BOT_NAME = process.env.BOT_NAME;
const RAPH_NAME = process.env.RAPH_NAME;
var BOT_CHANNEL_ID, RAPH_ID;

// get bot channel id (can be null if not found)
getChannelId(BOT_CHANNEL_NAME, id => {
  BOT_CHANNEL_ID = id;
  if (!id) console.error(`#${BOT_CHANNEL_NAME} is not a valid channel name`);
});

// get raph dm id
convertToUserID(RAPH_NAME, (success, id) => {
  if (!success) return console.error(`Could not find id for ${RAPH_NAME}`);
  getDMChannel(id, (err, channelId) => {
    if (err) return console.error(`Failed to get channel id for ${RAPH_NAME}`);
    else RAPH_ID = id;
  });
});


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
  const userId = body.user_id;
  const responseUrl = body.response_url;
  callback(null);

  // delete prev message
  updateLastMsg(userId, null, null, () => {});

  db.hasUser(userId, (res, data) => {
    // user exists in db
    if (res && data.user_type) return display(userId, responseUrl, () => {});
    // user does not exist
    else {
      getFirstName(userId, (success, userName) => {
        if (success) return format.welcomeNewUser(userName, msg => sendMsgToUrl(msg, responseUrl));
        else return format.welcomeNewUser(data.username, msg => sendMsgToUrl(msg, responseUrl));
      });
    }
  });
}

// welcome user to channel
function welcomeUserToChannel(userId, channel, callback) {
  callback(null);

  if (channel === BOT_CHANNEL_ID)
    getFirstName(userId, (success, res) => {
      if (success) return sendMsgToChannel(userId, BOT_CHANNEL_NAME, `:wave: Welcome ${res} to #${BOT_CHANNEL_NAME}!\nI'm ${BOT_NAME}, here to help you find a team for ${db.HACKATHON}!\n` + "Type `/teambot` or `/teambot start` to begin searching for a team or `/teambot help` for a list of commands!");
      else return sendMsgToChannel(userId, BOT_CHANNEL_NAME, res);
    });
}

// parse commands
function parseCommands(msg, callback) {
  var text = msg.text.toLowerCase().split(" ");

  // welcome message or display personal info
  if (!(text[0].replace(" ","").length) || text[0] === "start") welcome(msg, callback);
  // list commands
  else if (text[0] === "help" || text[0] === "commands") format.helpMsg(callback);
  // display listed teams or members
  else if (text[0] === "list") list(text[1], msg.response_url, callback);
  // edit skills
  else if (text[0] === "skills") createSkills(msg, callback);
  // remove user
  else if (text[0] === "remove") removeUser(msg.user_id, msg.response_url, callback);
  // search for matches
  else if (text[0] === "search") search(msg.user_id, msg.response_url, callback);
  // add addtional info
  else if (text[0] === "info") {
    text = msg.text.substring(text.indexOf("info") + "info".length + 1);
    addInfo(msg.user_id, msg.response_url, text, callback);
  }
  else callback("Incorrect command.  Try `/teambot help` for a list of commands");
}

// parse interactive messages
function parseIMsg(msg, callback) {
  msg = JSON.parse(msg.payload);
  const callbackID = msg.callback_id;
  const actions = msg.actions;

  // delete previous unfinished message to prevent altering info
  updateLastMsg(msg.user.id, msg.message_ts, msg.response_url, success => {
    if (success) {
      if (callbackID === 'user_type') {
        setUserType(msg, actions[0].value, callback);
      } else if (callbackID === 'roles') {
        setRoles(msg, actions[0].value, (actions[0].name === "add"), callback);
      } else if (callbackID === 'skills' || callbackID === 'skillsLvl') {
        callback(null);

        // change existing skills
        if (callbackID === 'skills') {
          const value = (actions[0].selected_options) ? actions[0].selected_options[0].value : actions[0].value;

          updateSkillLevels(msg, actions[0].name, value, displaySkills);

        }
        // set new skills
        else updateSkillLevels(msg, actions[0].name, actions[0].value, displaySkillChoice);

      } else if (callbackID === 'discover') { // turn on discoverability
        if (actions[0].name === "yes") setDiscoverable(msg, true, actions[0].value, callback);
        else callback("All the best team-hunting! :smile:\nUse `/teambot search` to begin your search again!");
      } else if (callbackID === "request") {  // contact user
        notifyMatchedUser(msg.user.id, actions[0].value, actions[0].name, msg.response_url, callback);
      } else if (callbackID === "respond") {
        var data = JSON.parse(actions[0].value);
        if (actions[0].name === "accept") acceptTeamRequest(msg.user.name, data, msg.response_url, callback);
        else declineTeamRequest(msg.user.name, data, msg.response_url, callback);
      } else if (callbackID === "remove") {
        removeUser(msg.user.id, msg.response_url, callback);
      } else if (callbackID === "contact") {  // form new conversation between matched users
        contactUser(actions[0].value, msg.response_url, callback);
      } else if (callbackID === 'edit') {  // edit existing data
        // change user type
        if (actions[0].name === 'user_type') {
          editUserType(msg, actions[0].value, callback);
        }
        // set roles
        else if (actions[0].name === "roles") {
          setRoles(msg, null, true, callback);
        }
        else if (actions[0].name === "skills") {
          callback(null);
          updateSkillLevels(msg, null, null, displaySkills);
        }
        // find matches
        else if (actions[0].name === "search") {
          search(msg.user.id, msg.response_url, callback);
        }
        // turn off visibility
        else if (actions[0].name === "undiscover") {
          setDiscoverable(msg, false, actions[0].value, callback);
        }
        // remove additional info
        else if (actions[0].name === "info") {
          callback({
            "attachments": [
              {
                "title": "Commands to update info:",
                "text": " - `/teambot info remove` : remove your additional info\n - `/teambot info` : change your additional info (i.e. `/teambot info I Love Hack the North!` )  *Limit: 200 characters*",
                "fallback": "The features of this app are not supported by your device",
                "color": format.COLOUR,
                "attachment_type": "default",
                "mrkdwn_in": ["text"]
              }
            ]
          });
        }
        // reset user info
        else if (actions[0].name === "remove") {
          removeUser(msg.user.id, msg.response_url, callback);
        }
      }
    } else callback(null);
  });
}

// parse incoming events
function parseEvent(msg, callback) {
  if (msg.type === "url_verification")
    verifyURL(msg.challenge, callback);
  else if (msg.event.type === "member_joined_channel")
    welcomeUserToChannel(msg.event.user, msg.event.channel, callback);
}

// Lists teams or members
function list(type, responseUrl, callback) {
  var output = function (type, res, data) {
    if(!res) return displayErrorMsg(`Could not retrieve list of ${type}s`, msg => callback({ text: msg }));
    else if (!data) return callback(`No ${type}s found. :disappointed:`);

    const attachments = [];
    callback(null);

    async.forEachOf(data, (value, userId, innerCallback) => {
      db.getUserInfo(userId, (success, info) => {
        if (success) {
          const userName = info.username;

          // if valid username
          if(userName) format.formatUser(userId, userName, info.roles, info.skills, info.info, obj => attachments.push(obj));
          innerCallback();
        } else {
          return displayErrorMsg(`Could not get ${userId}'s info`, msg => sendMsgToUrl({ text: msg }, responseUrl));
        }
      });
    }, function (err) {
      if (err) {
        return displayErrorMsg(`Could not get list of ${type}s.\n${err.message}`, msg => sendMsgToUrl({ text: msg }, responseUrl));
      } else {
        return sendMsgToUrl({
         "text": `List of ${type}s:`,
         attachments: attachments
       }, responseUrl);
      }
    });
  };

  if(type === "members" || type === "member") { // display members
    db.getMembers((res, data) => output("member", res, data));
  } else if (type === "teams" || type === "team") { // display teams
    db.getTeams((res, data) => output("team", res, data));
  } else {
    callback("Incorrect command.  e.g. `/teambot list teams`");
  }
}

// display user info
function display(userId, responseUrl, callback) {
  callback(null)
  db.getUserInfo(userId, (res, info) => {
    if (res) {
      // format display
      format.formatInfo(info, attachments => sendMsgToUrl({ "attachments" : attachments }, responseUrl));

    } else displayErrorMsg(`Could not get info of ${userId}`, msg => sendMsgToUrl({ text: msg }, responseUrl));
  })
}

// Create new skills
function createSkills(msg, callback) {
  const responseUrl = msg.response_url;

  var text = msg.text.substring("skills".length).replace(/\s/g,'');

  if (!text) return db.getSkills(msg.user_id, (success, skillArr) => {
    callback(null);

    if (!skills) skillArr = [];
    displaySkills(skillArr, msg => sendMsgToUrl(msg, responseUrl));
  });

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

    // add new skills to old skills, if not, set old skill level to null
    db.getSkills(msg.user_id, (success, skillArr) => {
      if (!skillArr) skillArr = [];
      async.forEachOf(skills, (skill, index, next) => {
        if (index === skills.indexOf(skill)) {
          if (!skillArr.length) {
            skillArr.push({
              "skill": skill
            });
            return next();
          } else {
            for (var i = 0; i < skillArr.length; i++) {
              if (skillArr[i].skill === skill) {
                skillArr[i].level = null;
                return next();
              }
              else if (i === skillArr.length - 1) {
                skillArr.push({
                  "skill": skill
                });
                return next();
              }
            }
          }
        }
      }, err => {
        if (err) return displayErrorMsg(err, msg => sendMsgToUrl({ text: msg }, responseUrl));


        db.updateSkills(msg.user_id, skillArr, success => {
          if (!success) displayErrorMsg(`Failed to update skills for ${msg.user_id}`, msg => sendMsgToUrl({ text: msg }, responseUrl));
        });
      });
    });
  });
}

// display skills
function displaySkills(skillArr, callback) {
  if (!skillArr.length) return callback({ "text": "You don't have any skills to display.  To add skills, use `/teambot skills skill1, skill2, ...` (i.e. `/teambot skills Node.js, Python`)" });

  format.formatSkills(skillArr, obj => callback(obj));
}

// reset user info
function removeUser(userId, responseUrl, callback) {
  callback(null);

  db.hasUser(userId, (res, data) => {
    if (res) {
      db.deleteUser(userId, success => {
        if (success) sendMsgToUrl({
          "text": ":thumbsup: You have successfully been removed from the database!  Type `/teambot start` to begin your search again!  Happy hacking! :robot_face:"
        }, responseUrl);
        else displayErrorMsg(`Could not reset ${userId}`, msg => sendMsgToUrl({ "text": msg }));
      })
    }
    else sendMsgToUrl({ "text": "You are not in our database!" }, responseUrl);
  })
}

/* HELPERS */

// display error message
function displayErrorMsg(errorMsg, callback) {
  callback("Oops, something went wrong! :thinking_face:\nPlease contact an organizer! :telephone_receiver:");
  var errorMsg = `ERROR: ${errorMsg}`;
  console.error(errorMsg);

  // DM Raphael
  SLACK.api("chat.postMessage", {
    "text": errorMsg,
    "channel": RAPH_ID,
    "username": BOT_NAME
  }, (err, response) => {
    if (!response.ok) return console.error(`Failed to contact Raph.\nERROR: ${response.error}`);
  });
}

// Delete previous message and update with new one
function updateLastMsg(userId, newTs, newURL, callback) {
  db.getLastMsg(userId, (success, res) => {
    // has last msg
    if (res) {
      // delete last msg
      if (newTs === res.ts) return callback(true);
      else if (!newTs || newTs > res.ts) {
        sendMsgToUrl({ "text": " " }, res.response_url);
        if (newTs) db.updateLastMsg(userId, newTs, newURL, () => {});
        return callback(true);
      }
      // delete current msg
      else {
        sendMsgToUrl({ "text": "This message has timed out.  To start a new conversation, use `/teambot`"}, newURL);
        return callback(false);
      }
    } else if (newTs) db.updateLastMsg(userId, newTs, newURL, () => callback(true));
  });
}

// Get channel id of channel
function getChannelId(channelName, callback) {
  SLACK.api("channels.list", (err, response) => {
    if (!response.ok) {
      console.error(`Failed to retrieve list of channels from Slack API.\nError: ${response.error}`);
      callback(null);
    }

    for (var i = 0; i < response.channels.length; i++) {
      if (response.channels[i].name === channelName) return callback(response.channels[i].id);
      if (i === (response.channels.length - 1)) return callback(null);
    }
  });
}

// send message to webhook
function sendMsgToUrl(msg, url) {
  if (typeof msg === "string") return console.error(`Could not sent "${msg}": Improper msg type (should be object not string).`);
  else if (!url) return console.error(`Could not sent "${msg}": URL undefined.`);
  else {
    var slack = new Slack();
    slack.setWebhook(url);
    slack.webhook(msg, function(err, response) {});
  }
}

// send message to channel
function sendMsgToChannel(userId, channelName, msg) {
  SLACK.api("chat.postEphemeral", {
    "text": msg,
    "channel": `#${channelName}`,
    "user": userId
  }, (err, response) => {
    if (!response.ok) console.error(`Failed to send message to #${channelName}.\nError: ${response.error}`);
  });
}

// display skills
function displaySkillChoice(skills, callback) {
  var helper = function(skills) {
    if(!skills.length) return callback({
      text: ":thumbsup: Excellent! Your skill levels are all set!"
    });

    async.map(skills, (skill, next1) => {
      async.times(format.MAX_SKILL_LVL, (n, next2) => {
        next2(null, {
          "name": skill,
          "text": ":star:".repeat(n + 1),
          "type": "button",
          "value": n + 1
        });
      }, (err, actions) => {
        actions.push({
          "name": skill,
          "text": "Remove skill",
          "type": "button",
          "style": "danger",
          "value": "-1"
        });
        format.formatSkillLvl(skill, actions, obj => next1(null, obj));
      });
    }, (err, attachments) => {
      callback({
        text: `List the level of proficiency of each skill (${format.MAX_SKILL_LVL} = best):`,
        attachments: attachments
      });
    });
  }

  const skillArr = [];
  // if array of objects
  if (skills.length && typeof skills[0] !== 'string') {
    async.forEachOf(skills, (value, index, next) => {
      if (!value.level) skillArr.push(value.skill);
      next();
    }, err => {
      if (err) return displayErrorMsg(`Could not update skills for ${userId}: Database error`, msg => callback({ "text": msg }));
      else helper(skillArr);
    });
  } else helper(skills);
}

// Convert from username to id
function convertToUserID(userName, callback){
  // Send either a U123456 UserID or bob UserName and it will return the U123456 value all the time
  SLACK.api("users.list", function(err, response) {
    if (!response.ok) displayErrorMsg(`Failed to convert username of ${userName} to id: Database error\nError:${response.error}`, msg => callback(false, { text: msg }));
    for (var i = 0; i < response.members.length; i++) {
      if(response.members[i].id === userName || response.members[i].name === userName){
        return callback(true, response.members[i].id);
      }
      if (i === response.members.length - 1) displayErrorMsg("Failed to convert username to id: User could not be found", msg => callback(false, { text: msg }));
    }
  });
}

// convert from id to username
function convertToUserName(userId, callback){
  // Send either a U123456 UserID or bob UserName and it will return the bob value all the time
  SLACK.api("users.list", function(err, response) {
    if (!response.ok) displayErrorMsg(`Failed to convert id of ${userId} to username: Database error\nError: ${response.error}`, msg => callback({ text: msg }));
    for (var i = 0; i < response.members.length; i++) {
      if(response.members[i].id === userId || response.members[i].name === userId){
        return callback(response.members[i].name);
      }
      if (i === response.members.length) displayErrorMsg("Failed to convert username to id: User could not be found", msg => callback({ text: msg }));
    }
  });
}

// get first name of user
function getFirstName(userId, callback) {
  SLACK.api("users.info", {
    "user": userId
  }, function(err, response) {
    if (!response.ok) return displayErrorMsg(`Failed to get info of ${userId}: API error\nError: ${err}`, msg => callback(msg));
    else return callback(true, response.user.profile.first_name);
  });
}

// get DM channel ID
function getDMChannel(userId, callback) {
  SLACK.api("im.list", (err, response) => {
    if (!response.ok) return callback(response.error, null);

    async.forEachOf(response.ims, (obj, index, next) => {
      if (obj.user === userId) {
        return callback(null, obj.id);
      }
    }, err => {
      if (err) return callback(err, null);
    });
  });
}

// Role selection
function selectRoles(roles, callback, errorText = null) {
  async.map(ROLES, (role, next) => {
    if (roles.includes(role.role))
      return next(null, {
        "text": `${role.emote} ${role.role}  :white_check_mark:`,
        "fallback": "The features of this app are not supported by your device",
        "callback_id": "roles",
        "color": format.COLOUR,
        "attachment_type": "default",
        "actions": [
          {
            "name": "remove",
            "text": "Remove role",
            "type": "button",
            "value": `${role.role}`
          }
        ]
      });
    else
      return next(null, {
        "text": `${role.emote} ${role.role}`,
        "fallback": "The features of this app are not supported by your device",
        "callback_id": "roles",
        "color": format.COLOUR,
        "attachment_type": "default",
        "actions": [
          {
            "name": "add",
            "text": "Add to roles",
            "type": "button",
            "value": `${role.role}`
          }
        ]
      });
  }, (err, results) => {
    var text = (errorText) ? `\n*${errorText}*` : "";

    results.push(
      // Default Button
      {
        "text": `:thumbsup: That's all!  Begin the search!${text}`,
        "fallback": "The features of this app are not supported by your device",
        "callback_id": "roles",
        "color": (errorText) ? format.ERROR_COLOUR : format.COLOUR,
        "attachment_type": "default",
        "actions": [
          {
            "name": "done",
            "text": "Begin search",
            "type": "button",
            "style": "primary",
            "value": "done"
          }
        ],
        "mrkdwn_in": ["text"]
      }
    );
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
  });

  addUser(userId, userName, { userType: type }, success => {
    if (!success) {
      displayErrorMsg(`Failed to add ${msg.user_name}`, msg => sendMsgToUrl(msg, responseUrl));
    }
  });
}

function editUserType(msg, type, callback) {
  const responseUrl = msg.response_url;
  const userName = msg.user.name;
  const userId = msg.user.id;

  callback(null);

  db.updateType(userId, type, success => {
    if(success) {
      var isTeam = (type !== "team");
      var str = !isTeam ? "a team" : "members";
      db.updateTeam(userId, success => {
        if(success) {
          db.updateMember(userId, success => {
            if(success) {
              // prevents roles from writing over this msg
            //  sendMsgToUrl({ text: `:pencil: You are now looking for ${str}.` }, responseUrl);
              sendMsgToChannel(userId, msg.channel.name, `:pencil: You are now looking for ${str}.`);
              setTimeout(() => setRoles(msg, null, true, () => {}), 1500);
            } else {
              displayErrorMsg("Failed to update member", msg => {
                return sendMsgToUrl({
                  text: msg,
                  replace_original: true
                }, responseUrl);
              });
            }
          }, isTeam);
        } else {
          displayErrorMsg("Failed to update team", msg => {
            return sendMsgToUrl({
              text: msg,
              replace_original: true
            }, responseUrl);
          });
        }
      }, !isTeam);
    }
    else {
      displayErrorMsg(`Failed to update user type of ${msg.user_name}`, msg => {
        return callback({
          text: msg,
          replace_original: true
        });
      });
    }
  });
}

function setRoles(msg, role, add, callback) {
  const responseUrl = msg.response_url;

  callback(null);

  db.getUserInfo(msg.user.id, (res, userData) => {
    if (!res) return displayErrorMsg(`Could not get ${msg.user.name}'s info: Database error`, msg => sendMsgToUrl(msg, responseUrl));

    var roles = userData.roles;

    // errors is handled by parseRoles(null)
    if (role === 'done' && roles && roles.length) { // no more roles
      sendMsgToUrl({
        text: "You are looking to fill: " + roles.join(", ") + "\n:mag_right: Commencing search...",
        replace_original: true
      }, responseUrl);

      findMatch(userData, msg => sendMsgToUrl(msg, responseUrl));

    } else {
      if (!roles) roles = [];
      if(role) {
        if (add) roles.push(role);  // add role to list
        else {
          var index = roles.indexOf(role);
          if (index > -1) roles.splice(index, 1);  // remove role from list
        }
      }


      var text = (userData.user_type === 'team') ? "you're willing to fill on a team" : "you want to be filled on your team";

      var errorText = (role === "done") ? `Please select a role that ${text}!` : null;

      selectRoles(roles, attachments => {
        db.updateRoles(msg.user.id, roles, success => {
          if (success) {
            var text = (role) ? "Awesome!  Before we begin our search, tell us more about you!\n" : "";
            sendMsgToUrl({
              "text": `${text}What roles are you looking to fill?`,
              "replace_original": true,
              "attachments": attachments
            }, responseUrl);
          }
          else {
            displayErrorMsg(`ERROR: Could not update roles for ${msg.user.name}`, msg => sendMsgToUrl({ text: msg }, responseUrl));
          }
        });
      }, errorText);
    }
  });
}

// Search for matches
function search(userId, responseUrl, callback) {
  callback(null);

  db.getUserInfo(userId, (res, userData) => {
    if (!res) return displayErrorMsg(`Could not get ${msg.user.name}'s info: Database error`, msg => sendMsgToUrl(msg, responseUrl));
    else if (!userData.user_type || !userData.roles) return sendMsgToUrl({ "text": "We don't have enough information on you to perform a search!  Use `/teambot start` instead!" }, responseUrl);
    else findMatch(userData, msg => sendMsgToUrl(msg, responseUrl));
  });
}

// Return msg with formatted array of matches
/*
[{ "user_id","user_name","rating","roles","skills","ts" }]
*/
function findMatch(userData, callback) {
  const type = userData.user_type;
  const noMatchMsg = {
    text: `No ${type}s found. :disappointed:\nWould you like to be discoverable by other ${type}s?`,
    attachments: [
        {
            "fallback": "The features of this app are not supported by your device",
            "callback_id": "discover",
            "color": format.COLOUR,
            "attachment_type": "default",
            "actions": [
                {
                  "name": "yes",
                  "text": "Yes please!",
                  "type": "button",
                  "value": type
                },
                {
                  "name": "no",
                  "text": "No, it's ok!",
                  "type": "button",
                  "value": type
                }
            ]
        }
    ]
  };

  var handleMatches = function(data) {
    if (data) {
      const matches = [];

      async.forEachOf(data, (ts, matchId, next) => {
        db.getUserInfo(matchId, (res, matchData) => {
          match.rateUser(userData, matchData, rating => {
            if(rating) matches.push({
              "user_id": matchId,
              "user_name": matchData.username,
              "rating": rating,
              "roles": matchData.roles,
              "skills": matchData.skills,
              "info": matchData.info,
              "ts": ts
            });
            next();
          });
        });
      }, err => {
        if (err || !matches.length) return callback(noMatchMsg);
        else match.sortMatches(matches, sorted => {
          var text = "matches, starting with your best match:";
          if (sorted.length > match.MAX_MATCHES_DISPLAYED) {
            sorted = sorted.slice(0, match.MAX_MATCHES_DISPLAYED);
            text = `top ${match.MAX_MATCHES_DISPLAYED} matches, starting with your best match:`
          }
          return format.formatMatches(sorted, type, formatted => callback({
           "text": `:tada: We found some matches! :tada:\nHere are your ${text}`,
           attachments: formatted
         }));
        });
      });
    }
    else return callback(noMatchMsg);
  }

  // Perform matchmaking
  if (type === "team") db.getTeams((res, data) => {
    if(!res) {
      console.error(`Teams could not be retrieved: Database error`);
      return callback(null);
    }
    else handleMatches(data);
  });
  else db.getMembers((res, data) => {
    if(!res) {
      console.error(`Members could not be retrieved: Database error`);
      return callback(null);
    }
    else handleMatches(data);
  });
}

// Update skill Levels
function updateSkillLevels(msg, skill, level, callback) {
  const responseUrl = msg.response_url;
  const userId = msg.user.id;

  db.getSkills(userId, (res, skills) => {
    if (!res) return console.error(`Could not retrieve skills for ${userId}: Database error`);
    console.log(skills);

    if(!skills) skills = [];

    if (!skill) return callback(skills, msg => sendMsgToUrl(msg, responseUrl));
    else {
      for (var i = skills.length - 1; i >= 0; i--) {
        if(skills[i].skill === skill) {
          if (level === "-1") skills.splice(i, 1);  // remove skill
          else skills[i]["level"] = level;

          db.updateSkills(userId, skills, success => {
            return callback(skills, msg => sendMsgToUrl(msg, responseUrl));
          });
        }
      }
    }
  })
}

function setDiscoverable(msg, discoverable, category, callback) {
  if (discoverable) {
    db.updateVisibility(msg.user.id, true, success => {
      if(success) {
        var text = (category === "team") ? "your skills" : "the skills you're looking for"
        callback({
          "text": ":clap: Yay!  You are now discoverable to others and will be notified if they would like to team up!",
          "attachments": [
            {
              "title": "Next Steps:",
              "text": "1. `/teambot skills` : List down " + `${text}` + " (e.g. `/teambot skills Node.js, Python, Java`)\n2. `/teambot info` : Personalize your description with additional information, such as _project ideas_, _passions_, and _portfolio links_!  (e.g. `/teambot info I Love Hack the North!` )  *Limit: 200 characters*",
              "fallback": "The features of this app are not supported by your device",
              "color": format.COLOUR,
              "attachment_type": "default",
              "mrkdwn_in": ["text"]
            }
          ]
        });

        // delete last msg records
        db.updateLastMsg(msg.user.id, null, null, success => {
          if (!success) console.error(`Could not delete last msg for ${msg.user.id}`);
        });
      }
      else {
        return displayErrorMsg(`Could not update visibility of ${msg.user.name}`, callback);
      }
    });
    if (category === "team") { // member looking for teams
      db.updateMember(msg.user.id, success => {
        if (!success) return displayErrorMsg(`Could not add ${msg.user.name} into Member database`, callback);
      });
    } else if (category === "member") {  // team looking for members
      db.updateTeam(msg.user.id,  success => {
        if (!success) return displayErrorMsg(`Could not add ${msg.user.name} into Team database`, callback);
      });
    }
  } else {
    db.updateVisibility(msg.user.id, false, success => {
      if(success) {
        callback(`:thumbsup: Other ${category}s will no longer be able to discover you!`);
      }
      else {
        return displayErrorMsg(`Could not update visibility of ${msg.user.name}`, callback);
      }
    });
    db.undiscoverUser(msg.user.id, success => {
      if (!success) console.error(`ERROR: Failed to remove ${msg.user.name} from ${category} database`);
    });
  }
}

// Contact user to form a team
function notifyMatchedUser(userId, matchId, type, responseUrl, callback) {
  var text = (type === "team") ? "join your team" : "invite you to their team";

  // Get first name of match
  getFirstName(matchId, (success, matchName) => {
    if (!success) return callback(matchName);

    // Get first name of user
    getFirstName(userId, (success, userName) => {
      if (!success) return callback(userName);
      else callback(null);

      db.getUserInfo(userId, (success, info) => {
        if (!success) return displayErrorMsg(`Failed to retrieve info for ${userId}`, msg => sendMsgToUrl(msg, responseUrl));

        format.formatUser(userId, info.username, info.roles, info.skills, info.info, obj => {
          const attachments = [
            {
              "title": `New Match!`,
              "text": `:tada: You've got a match! :tada:   ${userName} would like to ${text}!\n Here's more about them:`,
              "fallback": "The features of this app are not supported by your device",
              "color": format.COLOUR
            }
          ];
          attachments.push(obj);
          const value = {
            "userId": userId,
            "userName": userName,
            "matchId": matchId,
            "matchName": matchName,
            "type": type
          }
          attachments.push({
            "text": (type === "team") ? "Would you to to accept them into your team?" : "Would you like to join their team?",
            "fallback": "The features of this app are not supported by your device",
            "callback_id": "respond",
            "color": format.COLOUR,
            "attachment_type": "default",
            "actions": [
              {
                "name": "accept",
                "text": "Yes",
                "type": "button",
                "style": "primary",
                "value": JSON.stringify(value)
              },
              {
                "name": "decline",
                "text": "No",
                "type": "button",
                "style": "danger",
                "value": JSON.stringify(value),
                "confirm": {
                  "title": "Are you sure?",
                  "ok_text": "Yes",
                  "dismiss_text": "No"
                }
              }
            ]
          });

          // DM matched user
          SLACK.api("chat.postMessage", {
            "attachments": JSON.stringify(attachments),  // convert to string in order for API to properly parse it
            "channel": matchId,
            "username": BOT_NAME
          }, (err, response) => {
            if (!response.ok) return displayErrorMsg(`Failed to send message to ${matchName}.\nError: ${response.error}`, msg => sendMsgToUrl({ "text": msg }, responseUrl));
            else return sendMsgToUrl({ "text": `Your request has been sent to ${matchName}!  *slackbot* will send you a message when ${matchName} replies! :smile:` }, responseUrl);
          });
        });
      });
    });
  });
}

// Add additional info
function addInfo(userId, responseUrl, info, callback) {
  if(!info.length) return callback({ "text": "Incorrect command!  Please fill in the additional information you want to display!  (i.e. `/teambot info I Love Hack the North!` )  *Limit: 200 characters*" });
  else if (info.length > 200) return callback({ "text": "Exceeded 200 character limit!  Please try again!" });
  else if (info.toLowerCase() === "remove") return removeInfo(userId, responseUrl, callback);
  callback(null);

  db.updateInfo(userId, info, success => {
    if(!success) return displayErrorMsg(`Failed to update additional info for ${userId}.\nInfo: ${info}`, msg => sendMsgToUrl({ "text": msg }, responseUrl));
    else return sendMsgToUrl({ "text": ":thumbsup: Your description has been updated!" }, responseUrl);
  })
}

// Remove additional info
function removeInfo(userId, responseUrl, callback) {
  callback(null);

  db.updateInfo(userId, null, success => {
    if(!success) return displayErrorMsg(`Failed to delete additional info for ${userId}.\nInfo: ${info}`, msg => sendMsgToUrl({ "text": msg }, responseUrl));
    else return sendMsgToUrl({ "text": ":thumbsup: Your description has been removed!" }, responseUrl);
  });
}

/*
{
  userId, userName, matchId, matchName, type
}
*/
function acceptTeamRequest(matchUserName, data, responseUrl, callback) {
  callback(null);

  var text = (data.type === "team") ? "their" : "your";

  SLACK.api("chat.postMessage", {
    "attachments": JSON.stringify([
      {
        "title": `Team Request Accepted`,
        "text": `${data.matchName} has accepted your request to join ${text} team :tada:\n Go and send <@${data.matchId}|${data.matchUserName}> a direct message!`,
        "fallback": "The features of this app are not supported by your device",
        "color": format.COLOUR
    }]),  // convert to string in order for API to properly parse it
    "channel": data.userId,
    "username": BOT_NAME
  }, (err, response) => {
    if (!response.ok) return displayErrorMsg(`${matchUserName} failed to send message to ${data.userName}.\nError: ${response.error}`, msg => sendMsgToUrl({ "text": msg }, responseUrl));
    else sendMsgToUrl({
      "text": `${data.userName} has been notified!  All the best and happy hacking! :robot_face:`,
      "attachments": JSON.stringify([
        {
          "text": `If you're done forming a team, you can remove yourself from ${BOT_NAME}!`,
          "fallback": "The features of this app are not supported by your device",
          "callback_id": "remove",
          "color": format.COLOUR,
          "attachment_type": "default",
          "actions": [
            {
              "name": "remove",
              "text": "Remove me!",
              "type": "button",
              "style": "danger",
              "value": "remove"
            }
          ]
      }]),  // convert to string in order for API to properly parse it
    }, responseUrl);
  });

  setTimeout(() => SLACK.api("chat.postMessage", {
    "attachments": JSON.stringify([
      {
        "fallback": "The features of this app are not supported by your device",
        "callback_id": "remove",
        "color": format.COLOUR,
        "attachment_type": "default",
        "actions": [
          {
            "name": "remove",
            "text": "Remove me!",
            "type": "button",
            "style": "danger",
            "value": "remove"
          }
        ]
    }]),  // convert to string in order for API to properly parse it
    "channel": data.userId,
    "username": BOT_NAME
  }, (err, response) => {
    if (!response.ok) displayErrorMsg(`${matchUserName} failed to send message to ${data.userName}.\nError: ${response.error}`, msg => sendMsgToUrl({ "text": msg }, responseUrl));
  }), 2000);
}

function declineTeamRequest(matchUserName, data, responseUrl, callback) {
  callback(null);
  var text = (data.type === "team") ? "their" : "your";

  SLACK.api("chat.postMessage", {
    "attachments": JSON.stringify([
      {
        "title": `Team Request Declined`,
        "text": `${data.matchName} has declined your request to join ${text} team.\n  Don't give up! Search for more matches using ` + "`/teambot search`!",
        "fallback": "The features of this app are not supported by your device",
        "callback_id": "contact",
        "color": format.COLOUR,
        "attachment_type": "default"
      }
    ]),
    "channel": data.userId,
    "username": BOT_NAME
  }, (err, response) => {
    if (!response.ok) return displayErrorMsg(`${matchUserName} failed to send message to ${data.userName}.\nError: ${response.error}`, msg => sendMsgToUrl({ "text": msg }, responseUrl));
    else return sendMsgToUrl({ "text": `You have declined ${data.userName}'s request!` }, responseUrl);
  });
}

// form new conversation
function contactUser(matchId, responseUrl, callback) {
  callback(null);

  getDMChannel(matchId, (err, channelId) => {
    if (err) return displayErrorMsg(`Failed to find IM id\nError: ${err}`, msg => sendMsgToUrl({ "text": msg }, responseUrl));

    SLACK.api("chat.postMessage", {
      "text": `Congratulations on forming your team!  All the best and happy hacking! :robot_face:`,
      "channel": channelId,
      "username": BOT_NAME
    }, (err, response) => {
      if (!response.ok) return displayErrorMsg(`${matchUserName} failed to send message to ${data.userName}.\nError: ${response.error}`, msg => sendMsgToUrl({ "text": msg }, responseUrl));
      else return sendMsgToUrl({ "text": `A new conversation between the two of you has been initiated!  Go ahead, it's time to form a life-long friendship! :hugging_face:` }, responseUrl);
    });
  });
}


/* Interact with data.js */

function addUser(userId, userName, { roles = [], skills = [],
  userType = null, visible = false } = {}, callback) {
  if (userName === undefined) callback(false);
  db.updateUser(userId, {
    "username": userName,
    "hackathon": db.HACKATHON,
    "roles": roles,
    "skills": skills,
    "user_type": userType,
    "visible": visible
  }, success => callback(success));
}

module.exports = {
  welcome,
  parseCommands,
  parseIMsg,
  parseEvent,
  list,
  display,
  createSkills
}
