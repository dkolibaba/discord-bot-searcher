import express from "express";
import FormData from "form-data";
import fetch from "node-fetch";
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
} from "discord-interactions";
import { VerifyDiscordRequest, DiscordRequest } from "./utils.js";
import {
  searchResult,
  makeResult,
  resultStringArray,
} from "./search-result.js";
import {
  SEARCH_COMMAND,
  TEST_COMMAND,
  PERMISSION_COMMAND,
  HasGuildCommands,
} from "./commands.js";
import {
  accessCheck,
  botPermissionsMessage,
  namesTranslate,
  writeBotPermissionsAdd,
  writeBotPermissionsDelete,
} from "./permissions.js";
import { sleep } from "./utils.js"

//Function to send results in HTML file to the channel
async function sendResultFile(channel_id) {
  const output = makeResult(resultStringArray);
  const messageBody = new FormData();
  messageBody.append(
    "payload_json",
    JSON.stringify({
      content: "File attached",
      attachments: [
        {
          id: 0,
          description: "Search result in html file",
          filename: "result.html",
        },
      ],
    })
  );
  messageBody.append("files[0]", output, {
    contentType: "text/html",
    name: "files[0]",
    filename: "result.html",
  });
  const messagePost = await fetch(
    `https://discord.com/api/v10/channels/${channel_id}/messages`,
    {
      method: "POST",
      body: messageBody,
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        "User-Agent":
          "DiscordBot (https://glitch.com/edit/#!/stingy-cottony-marionberry, 0.7.0)",
      },
    }
  );
  if (!messagePost.ok) {
    const respData = await messagePost.json();
    console.log(messagePost.status);
    throw new Error(JSON.stringify(respData));
  }
  return messagePost;
}

//Function to send permission descriptions
async function sendBotPermissions(guild_id, channel_id) {
  const messageForChat = await botPermissionsMessage(guild_id);
  console.log(messageForChat);
  const messagePost = await fetch(
    `https://discord.com/api/v10/channels/${channel_id}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content: messageForChat,
      }),
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        "Content-Type": "application/json; charset=UTF-8",
        "User-Agent":
          "DiscordBot (https://glitch.com/edit/#!/stingy-cottony-marionberry, 0.7.0)",
      },
    }
  );
  if (!messagePost.ok) {
    const respData = await messagePost.json();
    console.log(messagePost.status);
    throw new Error(JSON.stringify(respData));
  }
  return messagePost;
}

//Parser for array of messages we got before the last
async function messageArrayParse(messageArray, channel_id) {
  console.log("Array of messages: ", messageArray.length);
  for (let i = 0; i < messageArray.length; i++) {
    if (
      messageArray[i].embeds.length !== 0 ||
      messageArray[i].attachments.length !== 0
    )
      searchResult(messageArray[i]);
  }
  //In case we have 100 messages in the array - take the last and start a new message pack request with it else (if array is the last and has less than 100 messages) start file construction function
  if (messageArray.length === 100) {
    await messageArrayRequest(channel_id, messageArray[99].id);
  } else {
    await sendResultFile(channel_id);
    return;
  }
}

//Request for up to 100 messages from the channel after the stated message id and give them to parser
async function messageArrayRequest(channel_id, messageId) {
  sleep();
  return DiscordRequest(
    `channels/${channel_id}/messages?before=${messageId}&limit=100`,
    { method: "GET" }
  )
    .then((response) => response.json())
    .then((messageArray) => messageArrayParse(messageArray, channel_id));
}

//Request for the last message in channel and give it to content checker
async function lastMessage(channelData) {
  return DiscordRequest(
    `channels/${channelData.id}/messages/${channelData.last_message_id}`,
    {
      method: "GET",
    }
  )
    .then((response) => response.json())
    .then((message) => firstMessageParse(message));
}

//Service function to make content check of the first message and return message id for the message array request
function firstMessageParse(message) {
  if (message.embeds.length !== 0 || message.attachments.length !== 0)
    searchResult(message);
  return message.id;
}

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
export let searchString;
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post("/interactions", async function (req, res) {
  // Interaction type and data
  const { type, data, guild_id, channel_id, member } = req.body;
  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (
    type === InteractionType.APPLICATION_COMMAND &&
    accessCheck(guild_id, member)
  ) {
    const { name } = data;
    // "test" guild command
    if (name === "test") {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: "hello world ",
        },
      });
    }

    // "search" guild command
    if (name === "search" && accessCheck(guild_id, member)) {
      // Saving search string
      searchString = req.body.data.options[0].value;

      //Initiating search from the last message in channel
      try {
        await DiscordRequest(`channels/${channel_id}`, {
          method: "GET",
        })
          .then((response) => response.json())
          //Getting and checking the last message in channel
          .then((channelData) => lastMessage(channelData))
          //Getting and checking the first up to 100 messages before last. If more - start recursion
          .then((messageId) => messageArrayRequest(channel_id, messageId));
      } catch (err) {
        console.error("Error getting message:", err);
      }
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "Search finished.",
        },
      });
    }
    //"permission" guild command to make controls on who can execute bot commands
    if (name === "permission" && accessCheck(guild_id, member)) {
      //Option for printing existing permissions. Gives back a message with user names (unsername#discriminator format) and role names
      if (req.body.data.options[0].name === "print") {
        sendBotPermissions(guild_id, channel_id);
      }
      //Option for adding new entities to permissions. You can add users (both id and username#discriminator suit), roles (both id and name) !!!!(finish)or both
      else if (req.body.data.options[0].name === "add") {
        //Adding roles only
        if (
          req.body.data.options[0].options[0].name === "specify_roles_to_add" &&
          !req.body.data.options[1]
        ) {
          await namesTranslate(
            guild_id,
            req.body.data.options[0].options[0].value
          ).then((permissionsData) =>
            writeBotPermissionsAdd(guild_id, permissionsData)
          );
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "Roles added.",
            },
          });
        //Adding users only
      } else if (
        req.body.data.options[0].options[0].name === "specify_users_to_add" &&
        !req.body.data.options[1]
      ) {
        await namesTranslate(
          guild_id,
          null,
          req.body.data.options[0].options[0].value
        ).then((permissionsData) =>
          writeBotPermissionsAdd(guild_id, permissionsData)
        );
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "Users added.",
          },
        });
        //Adding roles and users
      } else if (
        req.body.data.options[0].options[0].name === "specify_roles_to_add" &&
        req.body.data.options[0].options[1].name === "specify_users_to_add"
      ) {
        await namesTranslate(
          guild_id,
          req.body.data.options[0].options[0].value,
          req.body.data.options[0].options[1].value
        ).then((permissionsData) =>
          writeBotPermissionsAdd(guild_id, permissionsData)
        );
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "Roles and users added.",
          },
        });
        //Adding users and roles
      } else if (
        req.body.data.options[0].options[0].name === "specify_users_to_add" &&
        req.body.data.options[0].options[1].name === "specify_roles_to_add"
      ) {
        await namesTranslate(
          guild_id,
          req.body.data.options[0].options[1].value,
          req.body.data.options[0].options[0].value
        ).then((permissionsData) =>
          writeBotPermissionsAdd(guild_id, permissionsData)
        );
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "Users and roles added.",
          },
        });
      }      
      //Option for deleting entities from permissions. You can specify users (both id and username#discriminator suit), roles (both id and name) !!!!(finish)or both
      } else if (req.body.data.options[0].name === "delete") {
        //Deleting roles only
        if (
          req.body.data.options[0].options[0].name ===
            "specify_roles_to_delete" &&
          !req.body.data.options[1]
        ) {
          await namesTranslate(
            guild_id,
            req.body.data.options[0].options[0].value
          ).then((permissionsData) =>
            writeBotPermissionsDelete(guild_id, permissionsData)
          );
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "Roles deleted.",
            },
          });
          //Deleting users only
        } else if (
          req.body.data.options[0].options[0].name ===
            "specify_users_to_delete" &&
          !req.body.data.options[1]
        ) {
          await namesTranslate(
            guild_id,
            null,
            req.body.data.options[0].options[0].value
          ).then((permissionsData) =>
            writeBotPermissionsDelete(guild_id, permissionsData)
          );
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "Users deleted.",
            },
          });
          //Deleting roles and users
        } else if (
        req.body.data.options[0].options[0].name === "specify_roles_to_delete" &&
        req.body.data.options[0].options[1].name === "specify_users_to_delete"
      ) {
        await namesTranslate(
          guild_id,
          req.body.data.options[0].options[0].value,
          req.body.data.options[0].options[1].value
        ).then((permissionsData) =>
          writeBotPermissionsDelete(guild_id, permissionsData)
        );
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "Roles and users deleted.",
          },
        });
          //Deleting users and roles
      } else if (
        req.body.data.options[0].options[0].name === "specify_users_to_add" &&
        req.body.data.options[0].options[1].name === "specify_roles_to_add"
      ) {
        await namesTranslate(
          guild_id,
          req.body.data.options[0].options[1].value,
          req.body.data.options[0].options[0].value
        ).then((permissionsData) =>
          writeBotPermissionsAdd(guild_id, permissionsData)
        );
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "Users and roles deleted.",
          },
        });
      }
      }
    }
  }
});

app.listen(PORT, () => {
  console.log("Listening on port", PORT);

  // Check if guild commands from commands.json are installed (if not, install them)
  HasGuildCommands(process.env.APP_ID, process.env.GUILD_ID, [
    TEST_COMMAND,
    SEARCH_COMMAND,
    PERMISSION_COMMAND,
  ]);
});
