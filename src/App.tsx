import { Board } from "./components/Board";
import { Header } from "./components/Header";
import { Home } from "./components/Home";
import { useRoute } from "./router";

export default function App() {
  const route = useRoute();
  return (
    <div className="min-h-dvh">
      <Header onBoard={route.page === "board"} />
      {route.page === "board" ? <Board key={route.id} boardId={route.id} /> : <Home />}
    </div>
  );
}
