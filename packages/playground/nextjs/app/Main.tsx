'use client';
import { Button, Space } from "antd";
import { useAppStore } from "./store/useAppStore";

export function Main() {
  const store = useAppStore();
  const increment = () => {
    const s = useAppStore.$getStore();
    s.increment();
  };
  const randomName = () => {
    const cap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const low = 'abcdefghijklmnopqrstuvwxyz';
    let name = cap[Math.random() * 26 | 0];
    for (let i = 0, len = 5 + Math.random() * 3 | 0; i < len; i++) {
      name += low[Math.random() * 26 | 0];
    }
    return name;
  };
  const setCurrName = () => store.setName(randomName());
  return (
    <Space direction="vertical">
      <Button type="primary" onClick={increment}>
        Increate
      </Button>
      <Button type="primary" onClick={setCurrName}>
        Generate the name in the upper right corner
      </Button>
    </Space>
  );
}
