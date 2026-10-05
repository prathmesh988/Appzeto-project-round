import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Organization {
  _id: string;
  name: string;
  slug: string;
  role: string;
}

interface OrgState {
  activeOrg: Organization | null;
  setActiveOrg: (org: Organization) => void;
  clearActiveOrg: () => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      activeOrg: null,
      setActiveOrg: (org) => set({ activeOrg: org }),
      clearActiveOrg: () => set({ activeOrg: null }),
    }),
    {
      name: "org-storage",
    }
  )
);
