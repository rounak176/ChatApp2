
import { Block as BaseBlock } from "baseui/block";
import { HeadingMedium as BaseHeadingMedium } from "baseui/typography";
import { Input as BaseInput } from "baseui/input";
import { Button as BaseButton } from "baseui/button";
import { FormControl as BaseFormControl } from "baseui/form-control";
import { useStyletron } from "baseui";

const Block: React.FC<any> = BaseBlock as any;
const HeadingMedium: React.FC<any> = BaseHeadingMedium as any;
const Input: React.FC<any> = BaseInput as any;
const Button: React.FC<any> = BaseButton as any;
const FormControl: React.FC<any> = BaseFormControl as any;

const INPUT_OVERRIDE = {
  Input: {
    style: () => ({
      backgroundColor: "white",
    }),
  },
};

export default function ChatHome({
  nickname,
  setNickname,
  joinRoomId,
  setJoinRoomId,
  handleJoinRoom,
  handleCreateRoom,
  isConnected,
}: {
  nickname: string;
  setNickname: (nickname: string) => void;
  joinRoomId: string;
  setJoinRoomId: (joinRoomId: string) => void;
  handleJoinRoom: () => void;
  handleCreateRoom: () => void;
  isConnected: boolean;
}) {
  const [css] = useStyletron();
  return (
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
          onClick={handleJoinRoom}
          disabled={!isConnected || !joinRoomId.trim() || !nickname.trim()}
        >
          Join Room
        </Button>
        <Button
          onClick={handleCreateRoom}
          disabled={!isConnected || !nickname.trim()}
        >
          Create New Room
        </Button>
      </Block>
    </Block>
  );
}
