import fs from "fs";
import { DiscordRequest, sleep } from "./utils.js";

//Func to check whether user may execute commands. In case there are no permissions added - returns true for any user.
export function accessCheck(guildId, guildMember) {
  const permissionData = fs.readFileSync("permissions.json");
  const { allowedUsers, allowedRoles } = JSON.parse(permissionData)[guildId];
  if (allowedUsers.length === 0 && allowedRoles.length === 0) {
    return true;
  }
  for (const id of allowedUsers) {
    if (id === guildMember.user.id) {
      return true;
    }
  }
  for (const role of allowedRoles) {
    for (const userRole of guildMember.roles)
      if (role === userRole) {
        return true;
      }
  }
  return false;
}

//Func to form message containing lists of allowed roles and users for current server
export async function botPermissionsMessage(guildId) {
  const permissionData = fs.readFileSync("permissions.json");
  const { allowedUsers, allowedRoles } = JSON.parse(permissionData)[guildId];
  try {
    const guildPreview = await DiscordRequest(`guilds/${guildId}/preview`, {
      method: "GET",
    }).then((response) => response.json());
    const guildRoles = await DiscordRequest(`guilds/${guildId}/roles`, {
      method: "GET",
    }).then((response) => response.json());
    let allowedRolesNames = [];
    let allowedUsersNames = [];
    for (const role of allowedRoles) {
      for (const guildRole of guildRoles) {
        if (role === guildRole.id) {
          allowedRolesNames.push(guildRole.name);
        }
      }
    }
    for (const id of allowedUsers) {
      sleep();
      const user = await DiscordRequest(`users/${id}`, {
        method: "GET",
      }).then((response) => response.json());
      allowedUsersNames.push(`${user.username}#${user.discriminator}`);
    }
    return `On server "${
      guildPreview.name
    }" bot commands are permitted for the roles [${allowedRolesNames.join(
      ", "
    )}] and users [${allowedUsersNames.join(", ")}]`;
  } catch (err) {
    console.error("Error getting data:", err);
  }
}
//Checker for item to not be included in array (returns false if there's a copy of item in array). Used for filtering allowances in delete function
function notIncludes (item, arrayForSearch) {
  for (const unit of arrayForSearch) {
    if (item === unit) {
      return false;
    }
  }
  return true;
}
//Func to delete roles and users from allowance lists.
export function writeBotPermissionsDelete(guildId, permissionsData) {
  const fileData = fs.readFileSync("permissions.json");
  let fileDataParsed = JSON.parse(fileData);
  if (permissionsData["allowedUsers"].length > 0) {
  fileDataParsed[guildId]["allowedUsers"] = fileDataParsed[guildId]["allowedUsers"].filter(
    (id) => notIncludes(id, permissionsData["allowedUsers"])
  );
  }
  if (permissionsData["allowedRoles"].length > 0) {
  fileDataParsed[guildId]["allowedRoles"] = fileDataParsed[guildId]["allowedRoles"].filter(
    (id) => notIncludes(id, permissionsData["allowedRoles"])
  );
  }
  fs.writeFileSync("permissions.json", JSON.stringify(fileDataParsed));
}
//Func to add roles and users to allowance lists.
export function writeBotPermissionsAdd(guildId, permissionsData) {
  const fileData = fs.readFileSync("permissions.json");
  let fileDataParsed = JSON.parse(fileData);
  if (permissionsData["allowedUsers"].length > 0) {
    //Check whether user already has permission (remove it from list before adding if true)
    for (const userOfInput of permissionsData["allowedUsers"]) {
      for (const userOfFile of fileDataParsed[guildId]["allowedUsers"]) {
        if (userOfInput === userOfFile) {
          permissionsData["allowedUsers"] = permissionsData["allowedUsers"].filter(
          (id) => id !== userOfFile
          );
          break;
        }
      }
    }
    fileDataParsed[guildId]["allowedUsers"].push(...permissionsData["allowedUsers"]);
  };
  if (permissionsData["allowedRoles"].length > 0) {
    //Check whether role already has permission (remove it from list before adding if true)
    for (const roleOfInput of permissionsData["allowedRoles"]) {
      for (const roleOfFile of fileDataParsed[guildId]["allowedRoles"]) {
        if (roleOfInput === roleOfFile) {
          permissionsData["allowedRoles"] = permissionsData["allowedRoles"].filter(
          (id) => id !== roleOfFile
          );
          break;
        }
      }
    }
    fileDataParsed[guildId]["allowedRoles"].push(...permissionsData["allowedRoles"]);
  }
  fs.writeFileSync("permissions.json", JSON.stringify(fileDataParsed));
}

export async function namesTranslate(guildId, rolesInput = null, usersInput = null) {
  let permissionsData = { allowedUsers: [], allowedRoles: [] };
  if (rolesInput) {
    const guildRoles = await DiscordRequest(`guilds/${guildId}/roles`, {
      method: "GET",
    }).then((response) => response.json());
    const rolesArray = rolesInput.replace(" ,", ",").replace(", ", ",").split(",");
    for (const role of rolesArray) {
      for (const guildRole of guildRoles) {
        if (Number(role)) {
          permissionsData["allowedRoles"].push(role);
        } else if (role === guildRole.name) {
          permissionsData["allowedRoles"].push(guildRole.id);
        }
      }
    }
  }
  if (usersInput) {
    const usersArray = usersInput.replace(" ,", ",").replace(", ", ",").split(",");
    for (const name of usersArray) {
      if (Number(name)) {
        permissionsData["allowedUsers"].push(name);
      } else {
        const { username, discriminator } = name.split("#");
        const guildmemebersQueryResult = await DiscordRequest(
          `guilds/${guildId}/members/search`,
          {
            method: "GET",
            body: { query: "${username}" },
          }
        ).then((response) => response.json());
        sleep();
        if (guildmemebersQueryResult.length === 1) {
          permissionsData["allowedUsers"].push(guildmemebersQueryResult[0].id);
        } else {
          for (const guildmember of guildmemebersQueryResult) {
            if (guildmember.discriminator === discriminator) {
              permissionsData["allowedUsers"].push(guildmember.id);
            }
          }
        }
      }
    }
  }
  return permissionsData;
}
