import { DiscordRequest } from './utils.js';

export async function HasGuildCommands(appId, guildId, commands) {
  if (guildId === '' || appId === '') return;

  commands.forEach((c) => HasGuildCommand(appId, guildId, c));
}

// Checks for a command
async function HasGuildCommand(appId, guildId, command) {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`;

  try {
    const res = await DiscordRequest(endpoint, { method: 'GET' });
    const data = await res.json();

    if (data) {
      const installedNames = data.map((c) => c['name']);
      // This is just matching on the name, so it's not good for updates
      if (!installedNames.includes(command['name'])) {
        console.log(`Installing "${command['name']}"`);
        InstallGuildCommand(appId, guildId, command);
      } else {
        console.log(`"${command['name']}" command already installed`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

// Installs a command
export async function InstallGuildCommand(appId, guildId, command) {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`;
  // install command
  try {
    await DiscordRequest(endpoint, { method: 'POST', body: command });
  } catch (err) {
    console.error(err);
  }
}


// Simple test command
export const TEST_COMMAND = {
  name: 'test',
  description: 'Basic guild command',
  type: 1,
};

// Command for searching content
export const SEARCH_COMMAND = {
  name: 'search',
  description: 'Launch a search for embeds and attachments with specified string',
  options: [
    {
      type: 3,
      name: 'enter_the_search_string',
      description: 'The text string to be used for search in message contents, embed titles and attached files names',
      required: true,
    },
  ],
  type: 1,
};

// Command for regulation permissions
export const PERMISSION_COMMAND = {
  name: 'permission',
  description: 'Command with options for checking, adding or deleting users and roles, who may execute bot commands',
  options: [
    {
      type: 1,
      name: 'print',
      description: 'Command to print existing permissions',
    },
    {
      type: 1,
      name: 'add',
      description: 'Command to add new permissions',
      options: [
        {
          type: 3,
          name: 'specify_roles_to_add',
          description: 'Write role names or id-s seperated by commas in string to add',
          required: false,
        },
        {
          type: 3,
          name: 'specify_users_to_add',
          description: 'Write user names (Name#dddd pattern) or id-s seperated by commas in string to add',
          required: false,
        }
      ],
    },
    {
      type: 1,
      name: 'delete',
      description: 'Command to delete existing permissions',
      options: [
        {
          type: 3,
          name: 'specify_roles_to_delete',
          description: 'Write role names or id-s seperated by commas in string to delete',
          required: false,
        },
        {
          type: 3,
          name: 'specify_users_to_delete',
          description: 'Write user names (Name#dddd pattern) or id-s seperated by commas in string to delete',
          required: false,
        }
      ],
    }
  ],
  type: 1,
};
