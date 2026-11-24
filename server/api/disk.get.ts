// Where the virtual machine's disk is, for the page to start the machine from
export default defineEventHandler(async (event) => {
  const { url } = await useDisk(event);
  return { url };
});
