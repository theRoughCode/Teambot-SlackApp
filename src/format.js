const async = require('async');
const COLOUR = "#3AA3E3";
const MAX_SKILL_LVL = 4;

// list commands
function helpMsg(callback) {
  callback({ text: "List of commands:\n  `/teambot` or `/teambot start` to edit your team profile!\n  `/teambot info` to update your description and let others know more about you and what you want to work on! (*Limit: 200 characters*)\n `/teambot list (members/teams)` to display the list of discoverable users\n  `/teambot remove` to remove your information from the database" });
}

// Welcome new users
function welcomeNewUser(userName, callback) {
  callback({
    text: `Hi ${userName}!  Allow me to assist you with forming a team!\nTo start, are you looking to join a team or are you looking for team members to join your team?`,
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

function formatMatches(sortedMatches, type, callback) {
  async.map(sortedMatches, (match, next) => {
    formatUser(match.user_id, match.user_name, match.roles, match.skills, match.info, obj => {
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
        "text": `I'm not ready to form a team just yet!`,
        "fallback": "Required plain-text summary of the attachment.",
        "color": COLOUR,
        "callback_id": "discover",
        "actions": [
          {
            "name": "no",
            "text": "End search",
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

function formatUser(userId, userName, roles, skills, info, callback) {
  const formRoles = (roles) ? roles.join(", ") : "N/A";
  const formSkills = (skills) ? skills.map(skill => {
    if(skill.level) return ` - ${skill.skill} (Level: ${skill.level})`;
    else return ` - ${skill.skill}`;
  }).join("\n") : "N/A";
  const formInfo = info || "N/A";

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
      },
      {
        "title": `Additional Info (Limit: 200 characters)`,
        "value": formInfo,
        "short": false
      }
    ]
  });
}

function formatInfo(data, callback) {
  const userType = (data.user_type) ? data.user_type.substring(0, 1).toUpperCase() + data.user_type.substring(1) : "N/A";
  const visible = (data.visible) ? "Yes" : "No";
  const formRoles = (data.roles) ? data.roles.join(", ") : "N/A";
  const formSkills = (data.skills) ? data.skills.map(skill => {
    if(skill.level) return ` - ${skill.skill} (Level: ${skill.level})`;
    else return ` - ${skill.skill}`;
  }).join("\n") : "N/A";
  const info = data.info || "N/A";

  displayButtons(data, buttons => {
    callback([
      {
        "fallback": "Required plain-text summary of the attachment.",
        "color": COLOUR,
        "pretext": "Here are your preferences!",
        "mrkdwn_in": ["fields"],
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
                "title": `Skills`,
                "value": formSkills,
                "short": true
            },
            {
              "title": `Additional Info (Limit: 200 characters)`,
              "value": info,
              "short": false
            }
        ]
      }, ...buttons
    ]);
  });
}

// Welcome returning user
function displayButtons(data, callback) {
  var actions1 = [];
  var actions2 = [];

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
  actions1.push(action_userType);

  // Set roles
  if (!data.roles) {
    actions1.push({
      "name": "roles",
      "text": "Pick roles",
      "type": "button",
      "value": "roles"
    });
  } else {
    actions1.push({
      "name": "roles",
      "text": "Change roles",
      "type": "button",
      "value": "roles"
    });

    // Turn off visibility
    if (data.visible)
      actions1.push({
        "name": "undiscover",
        "text": "Hide me!",
        "type": "button",
        "value": (data.user_type === "team") ? "team" : "member"
      });

  }

  // Set skills
  if (data.skills)
    actions1.push({
      "name": "skills",
      "text": "Change skills",
      "type": "button",
      "value": "change"
    });

  // Remove Additional Info
  if(data.info) actions1.push({
    "name": "info",
    "text": "Update info",
    "type": "button",
    "value": "info"
  });

  // Search for match
  actions2.push({
    "name": "search",
    "text": "Begin search",
    "style": "primary",
    "type": "button",
    "value": "search"
  });

  // Remove User
  actions2.push({
    "name": "remove",
    "text": "Remove me",
    "type": "button",
    "style": "danger",
    "value": "remove",
    "confirm": {
      "title": "Are you sure?",
      "text": `If you click "Yes", your preferences and information stored will be deleted!`,
      "ok_text": "Yes",
      "dismiss_text": "No"
    }
  });

  callback([
    {
      "title": "Edit information:",
      "fallback": "The features of this app are not supported by your device",
      "callback_id": "edit",
      "color": COLOUR,
      "attachment_type": "default",
      "actions": actions1
    },
    {
      "title": "Other actions:",
      "fallback": "The features of this app are not supported by your device",
      "callback_id": "edit",
      "color": COLOUR,
      "attachment_type": "default",
      "actions": actions2
    }
  ]);
}

function formatSkillLvl(skill, actions, callback) {
  callback({
    "fallback": "The features of this app are not supported by your device",
    "callback_id": "skillsLvl",
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

      var actions = [
        {
          "name": skill.skill,
          "text": "Change level...",
          "type": "select",
          "options": [... Array(MAX_SKILL_LVL).keys()].map(lvl => {
            return {
              "text": ":star:".repeat(lvl + 1),
              "value": lvl + 1
            }
          })
        },
        {
          "name": skill.skill,
          "text": "Remove skill",
          "type": "button",
          "style": "danger",
          "value": "-1"
        }
      ];

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
  formatMatches,
  formatUser,
  formatInfo,
  formatSkillLvl,
  formatSkills
}
