import { memo, type RefObject } from "react";

type Props = {
  inputRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File | null) => void;
};

export const UserProfileStoryFileInput = memo(function UserProfileStoryFileInput({ inputRef, onFile }: Props) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/*,video/*"
      className="sr-only"
      onChange={(e) => {
        const file = e.target.files?.[0] ?? null;
        e.target.value = "";
        onFile(file);
      }}
    />
  );
});
