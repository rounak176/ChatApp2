import React, { useState, useEffect, useRef } from "react";
import {
  TelepartyClient,
  SocketEventHandler,
  SocketMessageTypes,
  SessionChatMessage,
} from "teleparty-websocket-lib";
import { Block as BaseBlock } from "baseui/block";
import { HeadingLarge as BaseHeadingLarge } from "baseui/typography";
import { Input as BaseInput } from "baseui/input";
import { Button as BaseButton } from "baseui/button";
import { Notification as BaseNotification, KIND } from "baseui/notification";
import { Spinner, SIZE as spinnerSize } from "baseui/spinner";
import { useStyletron } from "baseui";
import ChatHome from "./chat-home";

const Block: React.FC<any> = BaseBlock as any;
const HeadingLarge: React.FC<any> = BaseHeadingLarge as any;
const Input: React.FC<any> = BaseInput as any;
const Button: React.FC<any> = BaseButton as any;
const Notification: React.FC<any> = BaseNotification as any;

const MessageItem = React.memo(
  ({
    message,
    isCurrentUser,
  }: {
    message: SessionChatMessage;
    isCurrentUser: boolean;
  }) => {
    const [css] = useStyletron();
    return (
      <Block
        className={css({
          padding: "8px 12px",
          margin: "8px 0",
          borderRadius: "8px",
          backgroundColor: message.isSystemMessage
            ? "#e0e0e0"
            : isCurrentUser
            ? "#dcf8c6"
            : "white",
          alignSelf: isCurrentUser ? "flex-end" : "flex-start",
          maxWidth: "80%",
          marginLeft: isCurrentUser ? "auto" : "0",
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
    );
  }
);

const MessageList = ({
  messages,
  otherUsersTyping,
  nickname,
  messageListRef,
}: {
  messages: SessionChatMessage[];
  otherUsersTyping: string[];
  nickname: string;
  messageListRef: React.RefObject<HTMLDivElement> | null;
}) => {
  const [css] = useStyletron();
  return (
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
      {messages.length === 0 && (
        <Block
          className={css({
            textAlign: "center",
            color: "#999",
            margin: "20px 0",
          })}
        >
          No messages yet. Start a conversation!
        </Block>
      )}

      {messages.map((message, index) => (
        <MessageItem
          key={index}
          message={message}
          isCurrentUser={message.userNickname === nickname}
        />
      ))}

      {otherUsersTyping.length > 0 && (
        <Block
          className={css({
            fontStyle: "italic",
            color: "#888",
            padding: "5px 10px",
          })}
        >
          {otherUsersTyping.length === 1
            ? `${otherUsersTyping[0]} is typing...`
            : `${otherUsersTyping.join(", ")} are typing...`}
        </Block>
      )}
    </Block>
  );
};

const Chat = ({
  nickname,
  messages,
  otherUsersTyping,
  messageListRef,
  resetAllStates,
  roomId,
  messageText,
  handleTyping,
  handleKeyPress,
  sendMessage,
  isConnected,
}: {
  nickname: string;
  messages: SessionChatMessage[];
  otherUsersTyping: string[];
  messageListRef: React.RefObject<HTMLDivElement> | null;
  resetAllStates: () => void;
  roomId: string;
  messageText: string;
  handleTyping: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  sendMessage: () => void;
  isConnected: boolean;
}) => {
  const [css] = useStyletron();
  return (
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

      <MessageList
        messages={messages}
        otherUsersTyping={otherUsersTyping}
        nickname={nickname}
        messageListRef={messageListRef}
      />

      <Block
        className={css({
          display: "flex",
          gap: "10px",
          justifyContent: "space-between",
        })}
      >
        <Input
          value={messageText}
          onChange={handleTyping}
          onKeyDown={handleKeyPress}
          placeholder="Type your message..."
          style={{ flex: 1 }}
        />
        <Button
          onClick={sendMessage}
          disabled={!messageText.trim() || !isConnected}
        >
          Send
        </Button>
      </Block>
    </Block>
  );
};

// Local storage keys
const STORAGE_KEYS = {
  ROOM_ID: "teleparty_room_id",
  NICKNAME: "teleparty_nickname",
  MESSAGES: "teleparty_messages",
};

const RECONNECT_INTERVAL = 5000; // 5 seconds
let manualDisconnect = false;

type User = {
  firebaseUid: string;
  isCloudPlayer: string;
  isHost: string;
  permId: string;
  socketConnectionId: string;
  userSettings: {
    userNickname: string;
  };
};

type TelepartyUser = {
  userId: string;
  nickname: string;
};

export default function ChatApplication() {
  const [css, theme] = useStyletron();
  const [client, setClient] = useState<TelepartyClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);
  const [roomId, setRoomId] = useState<string>("");
  const [joinRoomId, setJoinRoomId] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [messageText, setMessageText] = useState<string>("");
  const [messages, setMessages] = useState<SessionChatMessage[]>([]);
  const [usersTyping, setUsersTyping] = useState<string[]>([]);
  const messageListRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connectionReadyCount, setConnectionReadyCount] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<TelepartyUser[]>([]);

  // Get event handler for Teleparty client
  const getEventHandler = () => {
    const eventHandler: SocketEventHandler = {
      onConnectionReady: () => {
        setIsConnected(true);
        setConnectionReadyCount((prevCount) => prevCount + 1);
      },
      onClose: () => {
        console.log("Disconnected from Teleparty server");
        setIsConnected(false);
        if (!manualDisconnect) {
          setReconnecting(true);
          setTimeout(() => {
            const eventHandler = getEventHandler();
            const newClient = new TelepartyClient(eventHandler);
            setClient(() => newClient);
            setReconnecting(false);
          }, RECONNECT_INTERVAL);
        }
      },
      onMessage: (message) => {
        const { type, data } = message;
        if (type === SocketMessageTypes.SEND_MESSAGE) {
          const chatMessage = data;
          // Check if this is a message we've already added locally
          setMessages((prev) => {
            // Look for a duplicate message
            const isDuplicate = prev.some(
              (existingMsg) =>
                existingMsg.body === chatMessage.body &&
                existingMsg.userNickname === chatMessage.userNickname &&
                Math.abs(existingMsg.timestamp - chatMessage.timestamp) < 2000
            );

            // Only add if not duplicate
            return isDuplicate ? prev : [...prev, chatMessage];
          });
        } else if (type === SocketMessageTypes.SET_TYPING_PRESENCE) {
          const typingData = data;
          setUsersTyping(typingData.usersTyping || []);
        } else if (type == "userId") {
          if (data.userId !== userId) {
            setUserId(data.userId || "");
          }
        } else if (type == "userList") {
          const userList = data.map((user: User) => ({
            userId: user.socketConnectionId,
            nickname: user.userSettings.userNickname,
          }));
          setAllUsers([...userList]);
        }
      },
    };

    return eventHandler;
  };

  // Initialize client and load saved session data
  useEffect(() => {
    const savedRoomId = sessionStorage.getItem(STORAGE_KEYS.ROOM_ID);
    const savedNickname = localStorage.getItem(STORAGE_KEYS.NICKNAME);

    if (!client) {
      const eventHandler = getEventHandler();
      const newClient = new TelepartyClient(eventHandler);
      setClient(() => newClient);
    }

    if (savedRoomId && savedNickname) {
      setRoomId(savedRoomId);
      setNickname(savedNickname);
      setJoinRoomId(savedRoomId);
      setLoading(true);
    }

    return () => {
      if (client) {
        client.teardown();
      }
    };
  }, []);

  useEffect(() => {
    if (
      connectionReadyCount > 0 &&
      client &&
      isConnected &&
      !isInRoom &&
      roomId &&
      nickname
    ) {
      joinRoom();
    }
  }, [connectionReadyCount, client, isConnected, isInRoom, roomId, nickname]);

  // Update localStorage when session data changes
  useEffect(() => {
    if (isInRoom && roomId && nickname) {
      sessionStorage.setItem(STORAGE_KEYS.ROOM_ID, roomId);
      localStorage.setItem(STORAGE_KEYS.NICKNAME, nickname);
    } else if (!isInRoom && !loading && isConnected) {
      sessionStorage.removeItem(STORAGE_KEYS.ROOM_ID);
      localStorage.removeItem(STORAGE_KEYS.NICKNAME);
    }
  }, [isInRoom, roomId, nickname, loading]);

  // Auto-scroll message list when new messages arrive
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
      setRoomId(newRoomId);
      setIsInRoom(true);
      setMessages([]);
    } catch (error) {
      alert("Error creating room:" + error);
    }
  };

  const joinRoom = async (telepartyClient = client) => {
    if (
      !telepartyClient ||
      !isConnected ||
      !joinRoomId.trim() ||
      !nickname.trim()
    )
      return;

    try {
      const room = await telepartyClient.joinChatRoom(nickname, joinRoomId);
      setRoomId(joinRoomId);
      setIsInRoom(true);
      setMessages([...room.messages]);
    } catch (error) {
      alert("Error joining room:" + error);
    }

    setLoading(false);
  };

  const sendMessage = () => {
    // incase of empty message or connection failure or not in room we do not take any action.
    if (!client || !isConnected || !isInRoom || !messageText.trim()) return;

    // Create a unique ID for this message
    const permId = Date.now().toString();

    // Create a message object to add to the local messages immediately
    const messageObj: SessionChatMessage = {
      body: messageText,
      timestamp: Date.now(),
      userNickname: nickname,
      isSystemMessage: false,
      permId: permId,
    };

    // Add message to local state right away for immediate feedback
    setMessages((prev) => [...prev, messageObj]);

    client.sendMessage(SocketMessageTypes.SEND_MESSAGE, {
      body: messageText,
      permId: permId, // Send the permId to server
    });
    setMessageText("");
    client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
      typing: false,
    });
  };

  const resetAllStates = () => {
    manualDisconnect = true;
    setIsInRoom(false);
    setMessageText("");
    setUsersTyping([]);
    setRoomId("");
    setNickname("");
    setJoinRoomId("");
    setIsConnected(false);
    sessionStorage.removeItem(STORAGE_KEYS.ROOM_ID);
    localStorage.removeItem(STORAGE_KEYS.NICKNAME);
    if (client) {
      client.teardown();
      setClient(null);
      const eventHandler = getEventHandler();
      const newClient = new TelepartyClient(eventHandler);
      setClient(newClient);
    }
    manualDisconnect = false;
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setMessageText(newText);

    if (client && isInRoom) {
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Only send typing indicator if it changed (from not typing to typing or vice versa)
      const isTyping = newText.trim().length > 0;

      client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
        typing: isTyping,
        userNickname: nickname,
      });

      // Stop typing indicator after 2 seconds of inactivity
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          if (client) {
            client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
              typing: false,
              userNickname: nickname,
            });
          }
        }, 2000);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  // Filter out the current user's typing status
  const otherUsersTyping = allUsers
    .filter(
      (user) => user.userId !== userId && usersTyping.includes(user.userId)
    )
    .map((user) => user.nickname);

  const handleJoinRoom = () => {
    if (!client || !isConnected || !joinRoomId.trim() || !nickname.trim())
      return;
    joinRoom();
  };

  const handleCreateRoom = () => {
    if (!client || !isConnected || !nickname.trim()) return;
    createRoom();
  };

  return (
    <Block
      height="100vh"
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
        <Block
          display="flex"
          justifyContent="space-between"
          aria-label="Chat Status"
          alignItems="center"
          marginBottom={theme.sizing.scale600}
        >
          <HeadingLarge margin="0">Teleparty Chat</HeadingLarge>

          {reconnecting ? (
            <Notification kind={KIND.warning}>
              Reconnecting to chat server...
            </Notification>
          ) : isConnected ? (
            <Notification kind={KIND.positive}>
              Connected to chat server
            </Notification>
          ) : (
            <Notification kind={KIND.negative}>
              Connecting to chat server...
            </Notification>
          )}
        </Block>

        <Block
          aria-label="Chat Content"
          minHeight="500px"
          display="flex"
          flexDirection="column"
        >
          {loading ? (
            <Block margin="auto" textAlign="center">
              <Spinner
                $size={spinnerSize.large}
                className={css({
                  margin: "auto",
                })}
              />
              <div
                className={css({
                  ...theme.typography.LabelMedium,
                  paddingBlockStart: theme.sizing.scale650,
                  paddingBlockEnd: theme.sizing.scale500,
                })}
              >
                Loading chat messages...
              </div>
            </Block>
          ) : (
            <>
              {!isInRoom ? (
                <ChatHome
                  nickname={nickname}
                  setNickname={setNickname}
                  joinRoomId={joinRoomId}
                  setJoinRoomId={setJoinRoomId}
                  handleJoinRoom={handleJoinRoom}
                  handleCreateRoom={handleCreateRoom}
                  isConnected={isConnected}
                />
              ) : (
                <Chat
                  nickname={nickname}
                  messages={messages}
                  otherUsersTyping={otherUsersTyping}
                  messageListRef={
                    messageListRef as React.RefObject<HTMLDivElement>
                  }
                  resetAllStates={resetAllStates}
                  roomId={roomId}
                  messageText={messageText}
                  handleTyping={handleTyping}
                  handleKeyPress={handleKeyPress}
                  sendMessage={sendMessage}
                  isConnected={isConnected}
                />
              )}
            </>
          )}
        </Block>
      </Block>
    </Block>
  );
}
