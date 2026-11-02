export const PROFILE_NAME_KEY = "mancebox-name";
export const PROFILE_PHONE_KEY = "mancebox-phone";

export type Profile = {
  name: string;
  phone: string;
};

export function loadProfile(): Profile {
  if (typeof window === "undefined") return { name: "", phone: "" };
  return {
    name: localStorage.getItem(PROFILE_NAME_KEY) ?? "",
    phone: localStorage.getItem(PROFILE_PHONE_KEY) ?? "",
  };
}

export function saveProfile(profile: Profile) {
  localStorage.setItem(PROFILE_NAME_KEY, profile.name);
  localStorage.setItem(PROFILE_PHONE_KEY, profile.phone);
}

export function hasProfile(profile: Profile) {
  return profile.name.trim().length >= 2 && profile.phone.replace(/\D/g, "").length >= 9;
}
