import { defineStore } from "resea";

export const useAppStore = defineStore("counter", {
  state: () => {
    return {content:{ count: 0,}, name: 'seo' };
  },
  actions: {
    increment() {
      // this.content.count++;
      this.$patch(state => {
        state.content.count++;
      });
    },
    setName(value: string) {
      this.name = value;
    }
  },
  getters: {
    doubleCount(state) {
      return state.content.count * 2;
    },
  },
});
