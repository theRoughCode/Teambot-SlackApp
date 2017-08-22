const async = require('async');
const COLOUR = "#3AA3E3";
const DISPLAY_COLOUR = "#74c8fc";
const ERROR_COLOUR = "#ff5959";
const MAX_SKILL_LVL = 4;

// list commands
function helpMsg(callback) {
  callback({
    "attachments": [
      {
        "title": "List of commands:",
        "text": " - `/teambot` or `/teambot start` to view your team formation dashboard and edit your team profile!\n - `/teambot skills` to update/view your skills\n - `/teambot info` to update your description and let others know more about you and what you want to work on! (*Limit: 200 characters*)\n - `/teambot list (members/teams)` to display the list of discoverable users\n - `/teambot search` to perform a search\n - `/teambot remove` to remove yourself and prevent others from discovering you",
        "fallback": "List of commands:",
        "color": COLOUR,
        "attachment_type": "default",
        "mrkdwn_in": ["text"]
      }
    ]
  });
}

// Welcome new users
function welcomeNewUser(userName, callback) {
  callback({
    text: `Hi ${userName}!  Allow me to assist you with forming a team!\nTo start, are you looking to join a team or are you looking for team members to join your team?`,
    attachments: [
      {
        "text": "I want to:",
        "fallback": "I want to:",
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
      if (match.requested) {
        obj.fields.push({ "value": "Request sent! :white_check_mark:" });
      } else {
        var text = (type === "team") ? "Request to join" : "Invite as member";
        obj["callback_id"] = "request";
        obj["actions"] = [{
          "name": type,
          "text": text,
          "type": "button",
          "value": match.user_id
        }];
      }

      next(null, obj);
    });
  }, (err, matches) => {
    if (err) return displayErrorMsg("Could not sort matches", msg => callback({ "text": msg }));
    else {
      // None of the matches, add to database
      var text1 = `I have no more team requests to send and would like to keep searching.  Put me up to be discoverable and allow other ${type}s to match with me!`;

      matches.push({
        "text": text1,
        "fallback": text1,
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
      var text2 = `I have no more team requests to send, but I'm done searching for more teams right now.  Don't allow other ${type}s to find and match with me!`;
      matches.push({
        "text": text2,
        "fallback": text2,
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
    "fallback": `${userName}`,
    "color": DISPLAY_COLOUR,
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
        "fallback": "Here are your preferences!",
        "color": DISPLAY_COLOUR,
        "pretext": "Here are your preferences!",
        "mrkdwn_in": ["fields"],
        "fields": [
            {
                "title": "Looking For",
                "value": (userType.toLowerCase() === "team") ? "A team to join" : "Members for my team",
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

  // Search for match
  actions2.push({
    "name": "search",
    "text": "Begin search",
    "style": "primary",
    "type": "button",
    "value": "search"
  });

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
      actions2.push({
        "name": "undiscover",
        "text": "Remove me!",
        "type": "button",
        "style": "danger",
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

  // Remove User
  actions2.push({
    "name": "delete",
    "text": "Reset profile",
    "type": "button",
    "style": "danger",
    "value": "delete",
    "confirm": {
      "title": "Are you sure?",
      "text": `If you click "Yes", your current preferences will be reset!`,
      "ok_text": "Yes",
      "dismiss_text": "No"
    }
  });

  callback([
    {
      "title": "Edit information:",
      "fallback": "Edit information:",
      "callback_id": "edit",
      "color": COLOUR,
      "attachment_type": "default",
      "actions": actions1
    },
    {
      "title": "Other actions:",
      "fallback": "Other actions:",
      "callback_id": "edit",
      "color": COLOUR,
      "attachment_type": "default",
      "actions": actions2
    }
  ]);
}

function formatSkillLvl(skill, actions, callback) {
  callback({
    "fallback": skill,
    "callback_id": "skillsLvl",
    "color": COLOUR,
    "attachment_type": "default",
    "title": skill,
    "actions": actions
  });
}

// format for display of skills
function formatSkills(skillArr, callback) {
  var attachments = skillArr.map(skill => {

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

    var text = (skill.level) ? `${skill.skill} (Level: ${skill.level})` : `${skill.skill}`;

    return {
      "text": text,
      "fallback": text,
      "callback_id": "skills",
      "color": DISPLAY_COLOUR,
      "attachment_type": "default",
      "actions": actions
    };
  });

  attachments.push({
    "fallback": "Back to dashboard",
    "callback_id": "dashboard",
    "color": COLOUR,
    "attachment_type": "default",
    "actions": [{
      "name": "dashboard",
      "text": "Back to dashboard",
      "type": "button",
      "style": "primary",
      "value": "dashboard"
    }]
  });

  callback({
    "text": `Here are your skills (Level: out of ${MAX_SKILL_LVL}):`,
    "attachments": attachments
  });
}

module.exports = {
  COLOUR,
  DISPLAY_COLOUR,
  ERROR_COLOUR,
  MAX_SKILL_LVL,
  helpMsg,
  welcomeNewUser,
  formatMatches,
  formatUser,
  formatInfo,
  formatSkillLvl,
  formatSkills
}
