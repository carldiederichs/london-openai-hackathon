import type { Species } from "../pets";

export const SAMPLE_PETS: {
  id: string;
  name: string;
  description: string;
  species: Species;
  color: string;
  image: string;
}[] = [
  {
    id: "codex",
    name: "Codex",
    description: "The original little companion. Curious about everything.",
    species: "ghost",
    color: "#e5dbc8",
    image: "/pets/samples/codex.png",
  },
  {
    id: "dewey",
    name: "Dewey",
    description: "A calm companion with a taste for adventure.",
    species: "cat",
    color: "#bdc9b0",
    image: "/pets/samples/dewey.png",
  },
  {
    id: "fireball",
    name: "Fireball",
    description: "A tiny spark with an enormous amount of energy.",
    species: "dragon",
    color: "#eaa061",
    image: "/pets/samples/fireball.png",
  },
  {
    id: "hoots",
    name: "Hoots",
    description: "A sharp-eyed owl, always ready to explore.",
    species: "owl",
    color: "#bca9d7",
    image: "/pets/samples/hoots.png",
  },
  {
    id: "seedy",
    name: "Seedy",
    description: "Small green shoots. Big castle ambitions.",
    species: "frog",
    color: "#b7cb7b",
    image: "/pets/samples/seedy.png",
  },
];
