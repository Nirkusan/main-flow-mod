# 03: Progress per project

**What to build:** Progress survives `/clear` and new sessions in the same project folder, and stays separate between projects.

**Blocked by:** 01

**Status:** done

- [x] Every change to flow, runs, marks, feature or base is saved to `$.store` under a key derived from the project folder
- [x] `session.start` restores the saved progress for this project
- [x] A different project folder starts empty
- [x] Reset clears the saved progress too
