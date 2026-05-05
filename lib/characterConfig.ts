export type DefaultCharacterConfig = {
  name: string;
  age: string;
  appearance: string;
  outfit: string;
  accessory: string;
  personality: string;
  guideRole: string;
};

export const DEFAULT_GUIDE_CHARACTER: DefaultCharacterConfig = {
  name: "Joe",
  age: "10",
  appearance: "short slightly messy brown hair, large green eyes, expressive friendly face",
  outfit: "yellow hoodie and blue jeans",
  accessory: "",
  personality: "curious, energetic, slightly playful, brave, problem solver, asks simple questions that help children understand the topic",
  guideRole:
    "Joe is a recurring guide character. He should be present as the audience's curious companion, but the story should remain focused on the episode topic rather than Joe's personal life.",
};
