declare module "iran-cities-json" {
  const data: {
    ostan: { id: number; name: string }[];
    shahr: { id: number; name: string; ostan?: number }[];
  };
  export default data;
}