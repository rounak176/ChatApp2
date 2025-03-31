import React, { useState, useEffect, useRef } from "react";
import {
  TelepartyClient,
  SocketEventHandler,
  SocketMessageTypes,
  SessionChatMessage,
} from "teleparty-websocket-lib";
import { Block as BaseBlock } from "baseui/block";
import {
  HeadingLarge as BaseHeadingLarge,
  HeadingMedium as BaseHeadingMedium,
} from "baseui/typography";
import { Input as BaseInput } from "baseui/input";
import { Button as BaseButton } from "baseui/button";
import { Notification as BaseNotification, KIND } from "baseui/notification";
import { FormControl as BaseFormControl } from "baseui/form-control";
import { useStyletron } from "baseui";

const Block: React.FC<any> = BaseBlock as any;
const HeadingLarge: React.FC<any> = BaseHeadingLarge as any;
const HeadingMedium: React.FC<any> = BaseHeadingMedium as any;
const Input: React.FC<any> = BaseInput as any;
const Button: React.FC<any> = BaseButton as any;
const Notification: React.FC<any> = BaseNotification as any;
const FormControl: React.FC<any> = BaseFormControl as any;

const INPUT_OVERRIDE = {
  Input: {
    style: () => ({
      backgroundColor: "white",
    }),
  },
};

export default function ChatApplication() {
  const [css] = useStyletron();
  const [client, setClient] = useState<TelepartyClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);
  const [roomId, setRoomId] = useState<string>("");
  const [joinRoomId, setJoinRoomId] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");
  const [messageText, setMessageText] = useState<string>("");
  const [messages, setMessages] = useState<SessionChatMessage[]>([]);
  const [usersTyping, setUsersTyping] = useState<string[]>([]);
  const messageListRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reset, setReset] = useState(false);

  useEffect(() => {
    const eventHandler: SocketEventHandler = {
      onConnectionReady: () => {
        console.log("Connected to Teleparty server");
        setIsConnected(true);
      },
      onClose: () => {
        console.log("Disconnected from Teleparty server");
        setIsConnected(false);
      },
      onMessage: (message) => {
        const { type, data } = message;
        if (type === SocketMessageTypes.SEND_MESSAGE) {
          const chatMessage = data;
          setMessages((prev) => [...prev, chatMessage]);
        } else if (type === SocketMessageTypes.SET_TYPING_PRESENCE) {
          const typingData = data;
          setUsersTyping(typingData.usersTyping || []);
        }
      },
    };

    const newClient = new TelepartyClient(eventHandler);
    setClient(newClient);

    return () => {
      if (newClient) {
        newClient.teardown();
      }
    };
  }, [reset]);

  useEffect(() => {
    if (messageListRef.current) {
      const scrollContainer = messageListRef.current;

      if (!usersTyping.length || messages.length > 0) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, usersTyping]);

  const createRoom = async () => {
    if (!client || !isConnected || !nickname.trim()) return;

    try {
      const newRoomId = await client.createChatRoom(nickname);
      console.log("Created room with ID:", newRoomId);
      setRoomId(newRoomId);
      setIsInRoom(true);
    } catch (error) {
      alert("Error creating room:" + error);
      console.error("Error creating room:", error);
    }
  };

  const joinRoom = async () => {
    if (!client || !isConnected || !joinRoomId.trim() || !nickname.trim())
      return;

    try {
      const room = await client.joinChatRoom(nickname, joinRoomId);
      console.log("Joined room with ID:", room);
      setIsInRoom(true);
    } catch (error) {
      alert("Error joining room:" + error);
      console.error("Error joining room:", error);
    }
  };

  const sendMessage = () => {
    // incase of empty message or connection failure or not in room we do not take any action.
    if (!client || !isConnected || !isInRoom || !messageText.trim()) return;

    client.sendMessage(SocketMessageTypes.SEND_MESSAGE, {
      body: messageText,
    });
    setMessageText("");
    client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
      typing: false,
    });
  };

  const resetAllStates = () => {
    setIsInRoom(false);
    setMessageText("");
    setUsersTyping([]);
    setRoomId("");
    setNickname("");
    setJoinRoomId("");
    // disconnect old session in order to start a nee one
    if (client) {
      client.teardown();
    }
    setReset((p) => !p);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);

    if (client && isInRoom) {
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // this will basically sendthe typing indicator immediately on every keystroke
      client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
        typing: e.target.value.trim().length > 0,
      });

      // to clear the typing indication after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (client) {
          client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
            typing: false,
          });
        }
      }, 2000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  const MessageList = () => (
    <Block
      ref={messageListRef}
      className={css({
        height: "400px",
        overflowY: "auto",
        border: "1px solid #eee",
        borderRadius: "8px",
        padding: "10px",
        marginBottom: "15px",
        backgroundColor: "#f9f9f9",
      })}
    >
      {messages.map((message, index) => (
        <Block
          key={index}
          className={css({
            padding: "8px 12px",
            margin: "8px 0",
            borderRadius: "8px",
            backgroundColor: message.isSystemMessage
              ? "#e0e0e0"
              : message.userNickname === nickname
              ? "#dcf8c6"
              : "white",
            alignSelf:
              message.userNickname === nickname ? "flex-end" : "flex-start",
            maxWidth: "80%",
            marginLeft: message.userNickname === nickname ? "auto" : "0",
            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
          })}
        >
          <Block
            className={css({
              fontWeight: "bold",
              color: "#555",
              marginBottom: "5px",
            })}
          >
            {message.userNickname}
          </Block>

          <Block>{message.body}</Block>
          <Block
            className={css({
              fontSize: "0.7rem",
              color: "#888",
              textAlign: "right",
              marginTop: "5px",
            })}
          >
            {new Date(message.timestamp).toLocaleTimeString()}
          </Block>
        </Block>
      ))}

      {usersTyping.length > 0 && client && (
        <Block
          className={css({
            fontStyle: "italic",
            color: "#888",
            padding: "5px 10px",
          })}
        >
          Someone is typing...
        </Block>
      )}
    </Block>
  );

  return (
    <Block
      height="90vh"
      className={css({
        display: "grid",
        placeItems: "center",
      })}
    >
      <Block
        className={css({
          maxWidth: "800px",
          width: "100%",
          padding: "20px",
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
        })}
      >
        <HeadingLarge>Teleparty Chat</HeadingLarge>

        {isConnected ? (
          <Notification kind={KIND.positive}>
            Connected to chat server
          </Notification>
        ) : (
          <Notification kind={KIND.negative}>
            Connecting to chat server...
          </Notification>
        )}

        {!isInRoom ? (
          <Block
            className={css({
              padding: "16px",
              borderRadius: "8px",
            })}
          >
            <HeadingMedium margin="10px auto 30px">
              Join/Create Chat Room
            </HeadingMedium>

            <FormControl label="Your Nickname">
              <Input
                value={nickname}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNickname(e.currentTarget.value)
                }
                placeholder="Enter your nickname"
                overrides={INPUT_OVERRIDE}
              />
            </FormControl>

            <FormControl label="Room ID">
              <Input
                value={joinRoomId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setJoinRoomId(e.currentTarget.value)
                }
                placeholder="Enter room ID to join"
                overrides={INPUT_OVERRIDE}
              />
            </FormControl>

            <Block
              className={css({
                display: "flex",
                gap: "10px",
                justifyContent: "space-around",
              })}
            >
              <Button
                onClick={joinRoom}
                disabled={
                  !isConnected || !joinRoomId.trim() || !nickname.trim()
                }
              >
                Join Room
              </Button>
              <Button
                onClick={createRoom}
                disabled={!isConnected || !nickname.trim()}
              >
                Create New Room
              </Button>
            </Block>
          </Block>
        ) : (
          <Block>
            <Block display="flex" justifyContent="space-evenly">
              <Block margin="auto 0">
                <Button
                  shape="pill"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault();
                    resetAllStates();
                  }}
                >
                  Go back
                </Button>
              </Block>
              <Block
                className={css({
                  margin: "20px 0",
                  padding: "10px",
                  backgroundColor: "#e3f2fd",
                  borderRadius: "10px",
                  width: "75%",
                })}
              >
                <Block
                  className={css({
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  })}
                >
                  <Block>
                    <strong>Room ID:</strong> {roomId}
                  </Block>
                  <Block>
                    <strong>Your Nickname:</strong> {nickname}
                  </Block>
                </Block>
              </Block>
            </Block>

            <MessageList />

            <Block className={css({ display: "flex", gap: "10px" })}>
              <Input
                value={messageText}
                onChange={handleTyping}
                onKeyDown={handleKeyPress}
                placeholder="Type your message..."
                style={{ flex: 1 }}
                overrides={INPUT_OVERRIDE}
              />
              <Button onClick={sendMessage} disabled={!messageText.trim()}>
                Send
              </Button>
            </Block>
          </Block>
        )}
      </Block>
    </Block>
  );
}
