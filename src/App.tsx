import { BrowserRouter } from "react-router";
import { RouterView } from "./router";

const App = () => {
  return (
    <BrowserRouter>
      <RouterView />
    </BrowserRouter>
  );
};

export default App;