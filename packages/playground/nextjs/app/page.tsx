"use client";
import { Layout, Col, Row } from 'antd';
import { useAppStore } from "./store/useAppStore";
import { Main } from "./Main";
import "./style.css";
const { Header, Content } = Layout;


export default function Page() {
  const store = useAppStore();
  return (
    <Layout style={{ height: "100%" }}>
      <Header style={{ backgroundColor: '#fff', color: '#333', borderBottom: '1px solid #ddd' }}>
        <Row>
          <Col flex="100px">ReSeo</Col>
          <Col flex="auto"></Col>
          <Col flex="200px" style={{textAlign:'right'}}>Hello, { store.name }</Col>
        </Row>
      </Header>
      <Content style={{ backgroundColor: '#fff',display: 'flex', justifyContent: 'center',alignItems: 'center' }}>
        <div style={{textAlign:'center'}}>
          <h1>Resea is a state manager for React</h1>
          <h2>count: {store.content.count}</h2>
          <h3>doubleCount: {store.doubleCount}</h3>
          <Main></Main>
        </div>
      </Content>
    </Layout>
  );
}
