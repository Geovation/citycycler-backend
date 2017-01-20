import * as Seneca from "seneca";

import { image } from "./image";

export default function (): void {
    const seneca = Seneca();
    seneca
      .use(image, { seneca })
      .listen({
          type: "tcp",
      });
};
