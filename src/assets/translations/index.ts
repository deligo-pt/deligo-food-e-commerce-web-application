import en from "./en";
import pt from "./pt";

export const translations = {
  en,
  pt,
};

export type Language = keyof typeof translations;

export default translations