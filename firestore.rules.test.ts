import { readFileSync } from "node:fs";
import { after, before, beforeEach, test } from "node:test";

import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    setDoc,
    setLogLevel,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";

const PROJECT_ID = "moneyplanner-rules-test";
const HOUSEHOLD_ID = "household-a";
const FUTURE_EXPIRES_AT = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const PAST_EXPIRES_AT = new Date(Date.now() - 24 * 60 * 60 * 1000);
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
      expiresAt: FUTURE_EXPIRES_AT,
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
      expiresAt: FUTURE_EXPIRES_AT,
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
        expiresAt: FUTURE_EXPIRES_AT,
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
      expiresAt: PAST_EXPIRES_AT,
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
      expiresAt: FUTURE_EXPIRES_AT,
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

rulesTest(
  "household cannot be created with createdBy of another user",
  async () => {
    const db = testEnv!.authenticatedContext("dana").firestore();

    await assertFails(
      setDoc(doc(db, "households", "household-forged"), {
        createdBy: "alice",
        inviteCode: "SET234SET2",
        createdAt: "2026-05-10T00:00:00.000Z",
      }),
    );
  },
);

rulesTest(
  "household cannot be created without a string invite code",
  async () => {
    const db = testEnv!.authenticatedContext("dana").firestore();

    await assertFails(
      setDoc(doc(db, "households", "household-noinvite"), {
        createdBy: "dana",
        inviteCode: 123456,
        createdAt: "2026-05-10T00:00:00.000Z",
      }),
    );
  },
);

rulesTest("active members cannot change household createdBy", async () => {
  const db = testEnv!.authenticatedContext("alice").firestore();

  await assertFails(
    updateDoc(doc(db, "households", HOUSEHOLD_ID), {
      createdBy: "alice-2",
    }),
  );
});

rulesTest(
  "active members can rotate the household invite code without touching createdBy",
  async () => {
    const db = testEnv!.authenticatedContext("alice").firestore();

    await assertSucceeds(
      updateDoc(doc(db, "households", HOUSEHOLD_ID), {
        inviteCode: "NEW234NEW2",
        inviteCodeUpdatedAt: "2026-05-10T00:00:00.000Z",
      }),
    );
  },
);

rulesTest(
  "active members cannot change the uid of a join request",
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
    await assertFails(
      updateDoc(
        doc(db, "households", HOUSEHOLD_ID, "joinRequests", "charlie"),
        {
          uid: "mallory",
          status: "approved",
          reviewedBy: "alice",
        },
      ),
    );
  },
);

rulesTest(
  "invite code createdBy cannot be changed via update",
  async () => {
    const db = testEnv!.authenticatedContext("alice").firestore();

    await assertFails(
      setDoc(
        doc(db, "inviteCodes", "123456"),
        { createdBy: "mallory" },
        { merge: true },
      ),
    );
  },
);

// ── 世帯削除・退出フロー（build 26 発見事項 #2/#3 の回帰テスト）──

rulesTest(
  "active members can list their own household's invite codes",
  async () => {
    const db = testEnv!.authenticatedContext("alice").firestore();

    await assertSucceeds(
      getDocs(
        query(
          collection(db, "inviteCodes"),
          where("householdId", "==", HOUSEHOLD_ID),
        ),
      ),
    );
  },
);

rulesTest(
  "non-members cannot list invite codes even with a forged users doc",
  async () => {
    // charlie は users.householdId を持つが member ドキュメントがない
    // （自分で users を書き換えた攻撃者と同じ状態）
    const db = testEnv!.authenticatedContext("charlie").firestore();

    await assertFails(
      getDocs(
        query(
          collection(db, "inviteCodes"),
          where("householdId", "==", HOUSEHOLD_ID),
        ),
      ),
    );
  },
);

rulesTest(
  "unfiltered invite code listing is denied even for active members",
  async () => {
    const db = testEnv!.authenticatedContext("alice").firestore();

    await assertFails(getDocs(collection(db, "inviteCodes")));
  },
);

rulesTest("active members can delete their household's invite code", async () => {
  const db = testEnv!.authenticatedContext("alice").firestore();

  await assertSucceeds(deleteDoc(doc(db, "inviteCodes", "123456")));
});

rulesTest(
  "last member can delete household data, invite codes, then members+household in one batch",
  async () => {
    // removeHouseholdMember（最後の1人退出）/ 全データ削除と同じ順序を再現する:
    // サブコレクション → inviteCodes → (members + 世帯ドキュメントを1バッチ)
    const db = testEnv!.authenticatedContext("alice").firestore();

    await assertSucceeds(
      deleteDoc(doc(db, "households", HOUSEHOLD_ID, "transactions", "tx-1")),
    );
    await assertSucceeds(deleteDoc(doc(db, "inviteCodes", "123456")));

    const finalBatch = writeBatch(db);
    finalBatch.delete(doc(db, "households", HOUSEHOLD_ID));
    finalBatch.delete(doc(db, "households", HOUSEHOLD_ID, "members", "alice"));
    finalBatch.delete(doc(db, "households", HOUSEHOLD_ID, "members", "bob"));
    await assertSucceeds(finalBatch.commit());

    // 世帯削除後も自分の users ドキュメントは更新できる
    await assertSucceeds(
      setDoc(doc(db, "users", "alice"), { householdId: null }, { merge: true }),
    );
  },
);

rulesTest(
  "deleting own member doc first locks out later household deletion (regression guard)",
  async () => {
    // members を先に消すと activeMember 資格を失い世帯ドキュメントを消せなくなる。
    // 削除フロー実装が順序を誤った場合に検知するためのガード。
    const db = testEnv!.authenticatedContext("alice").firestore();

    await assertSucceeds(
      deleteDoc(doc(db, "households", HOUSEHOLD_ID, "members", "alice")),
    );
    await assertFails(deleteDoc(doc(db, "households", HOUSEHOLD_ID)));
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
      expiresAt: FUTURE_EXPIRES_AT,
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
