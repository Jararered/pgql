#ifndef FRAMEWORK_JSON_PROTOCOL_H
#define FRAMEWORK_JSON_PROTOCOL_H
#include <stddef.h>
/* Validates one JSON value, bounded to 64 nesting levels. No allocation. */
int framework_json_valid(const char *text, size_t length);
#endif
