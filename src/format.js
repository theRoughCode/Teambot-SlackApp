const async = require('async');
const COLOUR = "#3AA3E3";
const MAX_SKILL_LVL = 4;

// display error message
function displayErrorMsg(errorMsg, callback) {
  callback("Oops, something went wrong! :thinking-face:\nPlease contact an organizer! :telephone_receiver:");
  console.error(`ERROR: ${errorMsg}`);
}

// list commands
function helpMsg(callback) {
  callback({ text: "List of commands:\n  `/teambot` or `/teambot start` to begin the search!\n  `/teambot display` to display your preferences\n  `/teambot list (members/teams)` to display the list of discoverable users\n  `/teambot remove` to remove your information from the database" });
}

// Welcome new users
function welcomeNewUser(userName, callback) {
  callback({
    text: `Hi ${userName}!  I'm here to assist you with forming a team!\nTo start, are you looking to join a team or are you looking for team members to join your team?`,
    attachments: [
      {
        "text": "I want to:",
        "fallback": "The features of this app are not supported by your device",
        "callback_id": "user_type",
        "color": COLOUR,
        "attachment_type": "default",
        "actions": [
          {
            "name": "user_team",
            "text": "Join a team",
            "type": "button",
            "value": "team"
          },
          {
            "name": "user_member",
            "text": "Find members",
            "type": "button",
            "value": "member"
          }
        ]
      }
    ]
  });
}

// Welcome returning user
function welcomeOldUser(userName, data, callback) {
  var actions = [];

  // Set roles
  if (!data.roles) {
    actions.push({
      "name": "roles",
      "text": "Pick roles",
      "type": "button",
      "value": "roles"
    });
  }
  // Toggle visibility
  else if (!data.visible)
    actions.push({
      "name": "discover",
      "text": "Discover me!",
      "type": "button",
      "value": (data.user_type === "team") ? "team" : "member"
    });
  else {
    actions.push({
      "name": "undiscover",
      "text": "Hide me!",
      "type": "button",
      "value": (data.user_type === "team") ? "team" : "member"
    });
    var action_userType = {
      "name": "user_type",
      "text": "",
      "type": "button",
      "value": ""
    };

    // Switch user type
    if(data.user_type === "team") {
      action_userType["text"] = "Find members instead";
      action_userType["value"] = "member";
    } else if (data.user_type === "member") {
      action_userType["text"] = "Find a team instead";
      action_userType["value"] = "team";
    }
    actions.push(action_userType);
  }

  // Remove User
  actions.push({
    "name": "remove",
    "text": "Remove me",
    "type": "button",
    "value": "remove"
  });

  callback({
    text: `Welcome back ${userName}! What would you like to do?`,
    attachments: [
      {
        "text": "Select an action:",
        "fallback": "The features of this app are not supported by your device",
        "callback_id": "edit",
        "color": COLOUR,
        "attachment_type": "default",
        "actions": actions
      }
    ]
  });
}

function formatMatches(sortedMatches, type, callback) {
  async.map(sortedMatches, (match, next) => {
    formatUser(match.user_id, match.user_name, match.roles, match.skills, obj => {
      obj["callback_id"] = "request";
      obj["actions"] = [{
        "name": type,
        "text": (type === "team") ? "Request to join" : "Invite as member",
        "type": "button",
        "value": match.user_id
      }];
      next(null, obj);
    });
  }, (err, matches) => {
    if (err) return displayErrorMsg("Could not sort matches", msg => callback({ "text": msg }));
    else {
      // None of the matches, add to database
      matches.push({
        "text": `I would like to keep searching.  Make me discoverable by other ${type}s!`,
        "fallback": "Required plain-text summary of the attachment.",
        "color": COLOUR,
        "callback_id": "discover",
        "actions": [
          {
            "name": "yes",
            "text": "Discover me!",
            "style": "primary",
            "type": "button",
            "value": type
          }
        ]
      });

      // None of the matches, remove user
      matches.push({
        "text": `I would like to form a team on my own. Please remove me and my preferences!`,
        "fallback": "Required plain-text summary of the attachment.",
        "color": COLOUR,
        "callback_id": "remove",
        "actions": [
          {
            "name": "remove",
            "text": "Remove me",
            "style": "danger",
            "type": "button",
            "value": "remove"
          }
        ]
      });
      return callback(matches);
    }
  });
}

function formatUser(userId, userName, roles, skills, callback) {
  const formRoles = (roles) ? roles.join(", ") : "N/A";
  const formSkills = (skills) ? skills.map(skill => {
    if(skill.level) return ` - ${skill.skill} (Level: ${skill.level})`;
    else return ` - ${skill.skill}`;
  }).join("\n") : "N/A";

  callback({
    "fallback": "Required plain-text summary of the attachment.",
    "color": COLOUR,
    "title": `<@${userId}|${userName}>`,
    "fields": [
      {
        "title": "Roles",
        "value": formRoles,
        "short": true
      },
      {
        "title": `Skills (Level: out of ${MAX_SKILL_LVL})`,
        "value": formSkills,
        "short": true
      }
    ]
  });
}

function formatInfo(roles, skills, userType, visible, callback) {
  const formRoles = (roles) ? roles.join(", ") : "N/A";
  const formSkills = (skills) ? skills.map(skill => {
    if(skill.level) return ` - ${skill.skill} (Level: ${skill.level})`;
    else return ` - ${skill.skill}`;
  }).join("\n") : "N/A";

  callback({
      "fallback": "Required plain-text summary of the attachment.",
      "color": COLOUR,
      "pretext": "Here are your preferences!",
      "fields": [
          {
              "title": "Looking For",
              "value": userType,
              "short": true
          },
          {
              "title": "Discoverable?",
              "value": visible,
              "short": true
          },
          {
              "title": "Roles",
              "value": formRoles,
              "short": true
          },
          {
              "title": `Skills (Level: out of ${MAX_SKILL_LVL})`,
              "value": formSkills,
              "short": true
          }
      ]
  });
}

function formatSkillLvl(skill, actions, callback) {
  callback({
    "fallback": "The features of this app are not supported by your device",
    "callback_id": "skills",
    "color": COLOUR,
    "attachment_type": "default",
    "title": skill,
    "actions": actions
  });
}

// format for display of skills
function formatSkills(skillArr, callback) {
  callback({
    text: `Here are your skills (Level: out of ${MAX_SKILL_LVL}):`,
    attachments: skillArr.map(skill => {

      var actions =[
        {
          "name": skill,
          "text": "Choose level...",
          "type": "select",
          "options": [... Array(MAX_SKILL_LVL).keys()].map(lvl => {
            return {
              "text": ":star:".repeat(lvl + 1),
              "value": lvl + 1
            }
          })
        },
        {
          "name": skill,
          "text": "Remove skill",
          "type": "button",
          "style": "danger",
          "value": "-1"
        }
      ];

      console.log(actions);
      return {
        "text": (skill.level) ? `${skill.skill} (Level: ${skill.level})` : `${skill.skill}`,
        "fallback": "The features of this app are not supported by your device",
        "callback_id": "skills",
        "color": COLOUR,
        "attachment_type": "default",
        "actions": actions
      };
    })
  });
}

module.exports = {
  COLOUR,
  MAX_SKILL_LVL,
  displayErrorMsg,
  helpMsg,
  welcomeNewUser,
  welcomeOldUser,
  formatMatches,
  formatUser,
  formatInfo,
  formatSkillLvl,
  formatSkills
}
