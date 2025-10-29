import { Button, Space } from "antd";
import { useAppStore } from "./store/useAppStore";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";

/**
 * useReactive：把对象/数组做成深层响应式
 */
export const useReactive = <S extends Record<string, any>>(
  initialState: S
): S => {
  const [, setState] = useState({});
  const proxyMap = new WeakMap();
  const observer = <T extends Record<string, any>>(
    initialVal: T,
    cb: () => void
  ): T => {
    const cacheProxy = proxyMap.get(initialVal);
    if (cacheProxy) return cacheProxy;
    const proxy = new Proxy(initialVal, {
      get(target: T, key: string | symbol, receiver: any): any {
        const res: any = Reflect.get(target, key, receiver);
        const isObj = res !== null && typeof res === "object";
        return isObj ? observer(res, cb) : Reflect.get(target, key, receiver);
      },
      set(target: T, key: any, receiver: any): boolean {
        const ret = Reflect.set(target, key, receiver);
        cb();
        return ret;
      },
      defineProperty(
        target: T,
        key: string | symbol,
        attributes: PropertyDescriptor
      ): boolean {
        const ret = Reflect.defineProperty(target, key, attributes);
        cb();
        return ret;
      },
    });
    proxyMap.set(initialVal, proxy);
    return proxy;
  };
  const stateRef = useRef<S>(initialState);
  return observer(stateRef.current, () => setState({}));
};

/**
 * useProxy ref.value 的语法，但值是深层响应的
 */
export function useProxy<T extends any>(
  value: T
): { value: T } {
  const cacheRef = useRef<{ original: T | null; proxy: T | null }>({
    original: null,
    proxy: null,
  });

  const proxyState = <U extends {} | null | undefined>(
    value: U,
    trigger: () => void
  ): U => {
    if (
      cacheRef.current.original === value &&
      cacheRef.current.proxy !== null
    ) {
      return cacheRef.current.proxy as unknown as U;
    }
    let result: U;
    if (Array.isArray(value)) {
      result = value.map((v) => proxyState(v, trigger)) as unknown as U;
    } else if (value && typeof value === "object") {
      result = new Proxy(value, {
        get(t, k) {
          return proxyState((t as any)[k], trigger);
        },
        set(t, k, v) {
          const old = (t as any)[k];
          if (old === v) return true;
          (t as any)[k] = v;
          trigger();
          return true;
        },
      }) as unknown as U;
    } else {
      result = value;
    }
    cacheRef.current.original = value as unknown as T;
    cacheRef.current.proxy = result as unknown as T;
    return result;
  };
  const [state, setState] = useState(() =>
    proxyState(value, () => triggerRef.current?.())
  );

  const triggerRef = useRef<(() => void) | null>(null);
  triggerRef.current = useCallback(() => {
    setState((prev) => {
      if (prev === cacheRef.current.proxy) return prev;
      if (prev && typeof prev === "object") {
        return { ...prev } as unknown as T;
      }
      return prev;
    });
  }, []);

  return new Proxy({} as { value: T }, {
    get(_, p) {
      if (p === "value") return state;
      return undefined;
    },
    set(_, p, v) {
      if (p === "value") {
        if (v !== cacheRef.current.original) {
          setState(proxyState(v, () => triggerRef.current?.()));
        }
        return true;
      }
      return false;
    },
  });
}

export function Main() {
  const state = useReactive({
    a: { b: { c: 0 } },
    list: [1, { x: 10 }] as [number, { x: number }],
  });
  const str = useProxy('sea');
  const s = useProxy(0);
  const r = useProxy({ a: { b: { c: 0 } } });
  const store = useAppStore();
  const increment = () => {
    const s = useAppStore.$getStore();
    s.increment();
    // state.a.b.c++
  };
  const randomName = () => {
    const cap = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const low = "abcdefghijklmnopqrstuvwxyz";
    let name = cap[(Math.random() * 26) | 0];
    for (let i = 0, len = (5 + Math.random() * 3) | 0; i < len; i++) {
      name += low[(Math.random() * 26) | 0];
    }
    return name;
  };
  const setCurrName = () => store.setName(randomName());

  return (
    <Space direction="vertical">
      <Button onClick={() => state.a.b.c++}>deep++</Button>
      <span>{state.a.b.c}</span>

      <Button onClick={() => (state.list[1].x += 10)}>list[1].x+=10</Button>
      <span>{state.list[1].x}</span>

      <Button onClick={() => str.value = randomName()}>string</Button>
      <span> {str.value} </span>

      <Button onClick={() => s.value++}>num.value++</Button>
      <span> {s.value} </span>

      <Button onClick={() => r.value.a.b.c++}>R OBJS ++</Button>
      <span> {r.value.a.b.c} </span>

      <Button type="primary" onClick={()=>store.setNum()}>
        setNum
      </Button>
      <span> {store.num} </span>
      <Button type="primary" onClick={increment}>
        Increate
      </Button>
      <Button type="primary" onClick={setCurrName}>
        Generate the name in the upper right corner
      </Button>
    </Space>
  );
}
