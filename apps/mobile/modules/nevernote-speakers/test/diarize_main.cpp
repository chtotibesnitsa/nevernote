#include <cstdio>
#include <cstdlib>
#include "nn_diarize.h"
int main(int argc, char **argv) {
  std::vector<nn::Turn> turns; std::string err;
  if (!nn::Diarize(argv[1], argv[2], argv[3], argc > 4 ? argv[4] : "", 0.6f, -1, &turns, &err)) { fprintf(stderr, "%s\n", err.c_str()); return 1; }
  printf("[");
  for (size_t i = 0; i < turns.size(); i++) printf("%s{\"start\":%.3f,\"end\":%.3f,\"speaker\":%d}", i ? "," : "", turns[i].start, turns[i].end, turns[i].speaker);
  printf("]\n");
}
