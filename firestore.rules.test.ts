import { readFileSync } from "node:fs";
import { after, before, beforeEach, test } from "node:test";

import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
    deleteDoc,
    doc,
    getDoc,
    setDoc,
    setLogLevel,
    updateDoc,
    writeBatch,
} from "firebase/firestore";

const PROJECT_ID = "moneyplanner-rules-test";
const HOUSEHOLD_ID = "household-a";
const hasFirestoreEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

setLogLevel("silent");

let testEnv: RulesTestEnvironment | undefined;

before(async () => {
  if (!hasFirestoreEmulator) {
    return;
  }

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

beforeEach(async () => {
  if (!testEnv) {
    return;
  }

  await testEnv.clearFirestore();
  await seedHousehold();
});

after(async () => {
  await testEnv?.cleanup();
});

rulesTest("active household members can read household data", async () => {
  const db = testEnv!.authenticatedContext("alice").firestore();

  await assertSucceeds(
    getDoc(doc(db, "households", HOUSEHOLD_ID, "transactions", "tx-1")),
  );
});

rulesTest("removed members cannot read household data", async () => {
  const db = testEnv!.authenticatedContext("bob").firestore();

  await assertFails(
    getDoc(doc(db, "households", HOUSEHOLD_ID, "transactions", "tx-1")),
  );
});

rulesTest(
  "users without a member document cannot read household data",
  async () => {
    const db = testEnv!.authenticatedContext("charlie").firestore();

    await assertFails(
      getDoc(doc(db, "households", HOUSEHOLD_ID, "transactions", "tx-1")),
    );
  },
);

rulesTest("active members can remove another member", async () => {
  const db = testEnv!.authenticatedContext("alice").firestore();

  await assertSucceeds(
    updateDoc(doc(db, "households", HOUSEHOLD_ID, "members", "bob"), {
      removedAt: "2026-04-26T00:00:00.000Z",
    }),
  );
});

rulesTest("active members can create a replacement invite code", async () => {
  const db = testEnv!.authenticatedContext("alice").firestore();

  await assertSucceeds(
    setDoc(doc(db, "inviteCodes", "NEW234"), {
      householdId: HOUSEHOLD_ID,
      createdBy: "alice",
      createdAt: "2026-04-26T00:00:00.000Z",
      expiresAt: new Date("2026-06-01T00:00:00.000Z"),
      disabledAt: null,
    }),
  );
});

rulesTest(
  "household creators can create the first invite code in the setup batch",
  async () => {
    const db = testEnv!.authenticatedContext("dana").firestore();
    const householdId = "household-new";
    const batch = writeBatch(db);

    batch.set(doc(db, "households", householdId), {
      createdBy: "dana",
      inviteCode: "SET234",
      createdAt: "2026-04-26T00:00:00.000Z",
    });
    batch.set(doc(db, "users", "dana"), {
      householdId,
      displayName: "Dana",
    });
    batch.set(doc(db, "households", householdId, "members", "dana"), {
      displayName: "Dana",
      joinedAt: "2026-04-26T00:00:00.000Z",
    });
    batch.set(doc(db, "inviteCodes", "SET234"), {
      householdId,
      createdBy: "dana",
      createdAt: "2026-04-26T00:00:00.000Z",
      expiresAt: new Date("2026-06-01T00:00:00.000Z"),
      disabledAt: null,
    });

    await assertSucceeds(batch.commit());
  },
);

rulesTest("active members can disable an invite code", async () => {
  const db = testEnv!.authenticatedContext("alice").firestore();

  await assertSucceeds(
    setDoc(
      doc(db, "inviteCodes", "123456"),
      {
        disabledAt: new Date("2026-05-10T00:00:00.000Z"),
        updatedAt: "2026-05-10T00:00:00.000Z",
      },
      { merge: true },
    ),
  );
});

rulesTest(
  "active members cannot repoint an invite code to another household",
  async () => {
    const db = testEnv!.authenticatedContext("alice").firestore();

    await assertFails(
      setDoc(
        doc(db, "inviteCodes", "123456"),
        { householdId: "household-other" },
        { merge: true },
      ),
    );
  },
);

rulesTest(
  "active members cannot extend an invite code expiry via update",
  async () => {
    const db = testEnv!.authenticatedContext("alice").firestore();

    await assertFails(
      setDoc(
        doc(db, "inviteCodes", "123456"),
        { expiresAt: new Date("2027-01-01T00:00:00.000Z") },
        { merge: true },
      ),
    );
  },
);

rulesTest(
  "non-members cannot create invite codes for a household",
  async () => {
    const db = testEnv!.authenticatedContext("charlie").firestore();

    await assertFails(
      setDoc(doc(db, "inviteCodes", "BAD234"), {
        householdId: HOUSEHOLD_ID,
        createdBy: "charlie",
        createdAt: "2026-04-26T00:00:00.000Z",
        expiresAt: new Date("2026-06-01T00:00:00.000Z"),
        disabledAt: null,
      }),
    );
  },
);

rulesTest("non-members can create a pending join request", async () => {
  const db = testEnv!.authenticatedContext("charlie").firestore();

  await assertSucceeds(
    setDoc(doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie"), {
      uid: "charlie",
      inviteCode: "123456",
      displayName: "Charlie",
      status: "pending",
      requestedAt: "2026-05-10T00:00:00.000Z",
    }),
  );
});

rulesTest("join request with expired invite code is rejected", async () => {
  await testEnv!.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "inviteCodes", "123456"), {
      householdId: HOUSEHOLD_ID,
      createdBy: "alice",
      createdAt: "2026-04-01T00:00:00.000Z",
      expiresAt: new Date("2026-04-30T00:00:00.000Z"),
      disabledAt: null,
    });
  });

  const db = testEnv!.authenticatedContext("charlie").firestore();
  await assertFails(
    setDoc(doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie"), {
      uid: "charlie",
      inviteCode: "123456",
      displayName: "Charlie",
      status: "pending",
      requestedAt: "2026-05-10T00:00:00.000Z",
    }),
  );
});

rulesTest("join request with disabled invite code is rejected", async () => {
  await testEnv!.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "inviteCodes", "123456"), {
      householdId: HOUSEHOLD_ID,
      createdBy: "alice",
      createdAt: "2026-04-01T00:00:00.000Z",
      expiresAt: new Date("2026-06-01T00:00:00.000Z"),
      disabledAt: new Date("2026-05-01T00:00:00.000Z"),
    });
  });

  const db = testEnv!.authenticatedContext("charlie").firestore();
  await assertFails(
    setDoc(doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie"), {
      uid: "charlie",
      inviteCode: "123456",
      displayName: "Charlie",
      status: "pending",
      requestedAt: "2026-05-10T00:00:00.000Z",
    }),
  );
});

rulesTest("active members can review join requests", async () => {
  await testEnv!.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(
      doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie"),
      {
        uid: "charlie",
        displayName: "Charlie",
        status: "pending",
        requestedAt: "2026-05-10T00:00:00.000Z",
      },
    );
  });

  const db = testEnv!.authenticatedContext("alice").firestore();
  await assertSucceeds(
    updateDoc(doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie"), {
      status: "approved",
      reviewedBy: "alice",
    }),
  );
});

rulesTest(
  "active members can approve requests and create member docs",
  async () => {
    await testEnv!.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(
        doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie"),
        {
          uid: "charlie",
          displayName: "Charlie",
          status: "pending",
          requestedAt: "2026-05-10T00:00:00.000Z",
        },
      );
    });

    const db = testEnv!.authenticatedContext("alice").firestore();
    const batch = writeBatch(db);
    batch.set(
      doc(db, "households", HOUSEHOLD_ID, "members", "charlie"),
      {
        displayName: "Charlie",
        joinedAt: "2026-05-10T00:05:00.000Z",
      },
      { merge: true },
    );
    batch.set(
      doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie"),
      {
        status: "approved",
        reviewedAt: "2026-05-10T00:05:00.000Z",
        reviewedBy: "alice",
      },
      { merge: true },
    );

    await assertSucceeds(batch.commit());
  },
);

rulesTest(
  "non-member cannot self-add as member by forging their users doc",
  async () => {
    const db = testEnv!.authenticatedContext("charlie").firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, "users", "charlie"), { householdId: HOUSEHOLD_ID });
    batch.set(doc(db, "households", HOUSEHOLD_ID, "members", "charlie"), {
      displayName: "Charlie",
      joinedAt: "2026-05-10T00:00:00.000Z",
    });

    await assertFails(batch.commit());
  },
);

rulesTest("requester cannot self-approve join request", async () => {
  await testEnv!.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(
      doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie"),
      {
        uid: "charlie",
        displayName: "Charlie",
        status: "pending",
        requestedAt: "2026-05-10T00:00:00.000Z",
      },
    );
  });

  const db = testEnv!.authenticatedContext("charlie").firestore();
  await assertFails(
    updateDoc(doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie"), {
      status: "approved",
      reviewedBy: "charlie",
    }),
  );
});

rulesTest("requester can resubmit join request after rejection", async () => {
  await testEnv!.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(
      doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie"),
      {
        uid: "charlie",
        displayName: "Charlie",
        inviteCode: "123456",
        status: "rejected",
        requestedAt: "2026-05-09T00:00:00.000Z",
        reviewedAt: "2026-05-09T00:10:00.000Z",
        reviewedBy: "alice",
      },
    );
  });

  const db = testEnv!.authenticatedContext("charlie").firestore();
  await assertSucceeds(
    setDoc(doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie"), {
      uid: "charlie",
      inviteCode: "123456",
      displayName: "Charlie",
      status: "pending",
      requestedAt: "2026-05-10T00:00:00.000Z",
    }),
  );
});

rulesTest("requester can cancel their own pending join request", async () => {
  await testEnv!.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(
      doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie"),
      {
        uid: "charlie",
        displayName: "Charlie",
        inviteCode: "123456",
        status: "pending",
        requestedAt: "2026-05-10T00:00:00.000Z",
      },
    );
  });

  const db = testEnv!.authenticatedContext("charlie").firestore();
  await assertSucceeds(
    deleteDoc(doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie")),
  );
});

rulesTest("requester cannot cancel an approved join request", async () => {
  await testEnv!.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(
      doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie"),
      {
        uid: "charlie",
        displayName: "Charlie",
        inviteCode: "123456",
        status: "approved",
        requestedAt: "2026-05-10T00:00:00.000Z",
        reviewedAt: "2026-05-10T00:05:00.000Z",
        reviewedBy: "alice",
      },
    );
  });

  const db = testEnv!.authenticatedContext("charlie").firestore();
  await assertFails(
    deleteDoc(doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie")),
  );
});

rulesTest(
  "active members can delete household data before deleting the household document",
  async () => {
    const db = testEnv!.authenticatedContext("alice").firestore();

    await assertSucceeds(
      deleteDoc(doc(db, "households", HOUSEHOLD_ID, "transactions", "tx-1")),
    );
    await assertSucceeds(deleteDoc(doc(db, "households", HOUSEHOLD_ID)));
  },
);

rulesTest(
  "household deletion immediately blocks stale member access",
  async () => {
    await testEnv!.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(doc(context.firestore(), "households", HOUSEHOLD_ID));
    });

    const db = testEnv!.authenticatedContext("alice").firestore();

    await assertFails(
      getDoc(doc(db, "households", HOUSEHOLD_ID, "transactions", "tx-1")),
    );
  },
);

async function seedHousehold() {
  await testEnv!.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, "households", HOUSEHOLD_ID), {
      name: "テスト世帯",
      inviteCode: "123456",
      createdBy: "alice",
    });
    await setDoc(doc(db, "inviteCodes", "123456"), {
      householdId: HOUSEHOLD_ID,
      createdBy: "alice",
      createdAt: "2026-04-26T00:00:00.000Z",
      expiresAt: new Date("2026-06-01T00:00:00.000Z"),
      disabledAt: null,
    });
    await setDoc(doc(db, "users", "alice"), { householdId: HOUSEHOLD_ID });
    await setDoc(doc(db, "users", "bob"), { householdId: HOUSEHOLD_ID });
    await setDoc(doc(db, "users", "charlie"), { householdId: HOUSEHOLD_ID });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "members", "alice"), {
      uid: "alice",
      displayName: "Alice",
      removedAt: null,
    });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "members", "bob"), {
      uid: "bob",
      displayName: "Bob",
      removedAt: "2026-04-01T00:00:00.000Z",
    });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "transactions", "tx-1"), {
      date: "2026-04-26",
      amount: 1200,
      type: "expense",
      createdBy: "alice",
    });
  });
}

function rulesTest(name: string, fn: () => void | Promise<void>) {
  test(
    name,
    {
      skip: hasFirestoreEmulator
        ? false
        : "Firestore emulator is not running; use npm run test:rules",
    },
    fn,
  );
}
