// Makes reads from a terminal in raw mode with VMIN=0 return when they should. CheerpX's
// terminal ignores VMIN=0 and VTIME, so a read waits for a key however it's set up, and
// scripts that poll the keyboard on a timer (games: `stty -icanon min 0 time 1` then `dd`)
// stop until a key's pressed. poll() timeouts do work in CheerpX, so this waits with poll()
// first: up to VTIME tenths of a second (none if it's 0), returning 0 bytes if nothing comes,
// as Linux would.
//
// Loaded into every program through /etc/ld.so.preload (see the Dockerfile).
#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <poll.h>
#include <termios.h>
#include <unistd.h>

static ssize_t (*real_read)(int, void *, size_t);

ssize_t read(int fd, void *buf, size_t count) {
  if (!real_read) real_read = (ssize_t (*)(int, void *, size_t))dlsym(RTLD_NEXT, "read");

  int saved = errno;
  struct termios t;
  if (count > 0 && tcgetattr(fd, &t) == 0 && !(t.c_lflag & ICANON) && t.c_cc[VMIN] == 0) {
    struct pollfd p = {.fd = fd, .events = POLLIN};
    int ready = poll(&p, 1, t.c_cc[VTIME] * 100);
    if (ready == 0) return 0;
    if (ready < 0) return -1;
  }
  // tcgetattr sets errno for anything that isn't a terminal
  errno = saved;
  return real_read(fd, buf, count);
}

// What read() becomes in programs built with _FORTIFY_SOURCE
ssize_t __read_chk(int fd, void *buf, size_t count, size_t size) {
  (void)size;
  return read(fd, buf, count);
}
