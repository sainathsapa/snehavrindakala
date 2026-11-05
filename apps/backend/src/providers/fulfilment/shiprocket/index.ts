import { ShiprocketFulfilmentProvider } from "./shiprocket.provider";

export default async function shiprocketProvider({
  container,
  options,
}: any) {
  return new ShiprocketFulfilmentProvider(container, options);
}

export { ShiprocketFulfilmentProvider };
