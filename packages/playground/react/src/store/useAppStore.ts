import { defineStore } from "resea";

export const useAppStore = defineStore("counter", {
  state: () => {
    return {
      content: {
        count: 0,
      },
      num: 0,
      name: 'Seo'
    };
  },
  actions: {
    increment() {
      this.content.count++;
      // this.$patch(state => {
      //   state.content.count++;
      // });
    },
    setNum() {
      this.num++;
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
  persist: true
});
