import { makeTestEnv, makeTestFixture, nextTick } from "./helpers";
import { Component, Env } from "../src/component/component";
import {
  useState,
  onMounted,
  onWillUnmount,
  useRef,
  onPatched,
  onWillPatch,
  onWillStart,
  onWillUpdateProps,
  useSubEnv
} from "../src/hooks";
import { xml } from "../src/tags";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

// We create before each test:
// - fixture: a div, appended to the DOM, intended to be the target of dom
//   manipulations.  Note that it is removed after each test.
// - env: a WEnv, necessary to create new components

let fixture: HTMLElement;
let env: Env;

beforeEach(() => {
  fixture = makeTestFixture();
  env = makeTestEnv();
});

afterEach(() => {
  fixture.remove();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("hooks", () => {
  test("can use a state hook", async () => {
    class Counter extends Component<any, any> {
      static template = xml`<div><t t-esc="counter.value"/></div>`;
      counter = useState({ value: 42 });
    }
    const counter = new Counter(env);
    await counter.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>42</div>");
    counter.counter.value = 3;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>3</div>");
  });

  test("can use onMounted, onWillUnmount", async () => {
    const steps: string[] = [];
    function useMyHook() {
      onMounted(() => {
        steps.push("mounted");
      });
      onWillUnmount(() => {
        steps.push("willunmount");
      });
    }
    class MyComponent extends Component<any, any> {
      static template = xml`<div>hey</div>`;
      constructor(env) {
        super(env);
        useMyHook();
      }
    }
    const component = new MyComponent(env);
    await component.mount(fixture);
    expect(component).not.toHaveProperty("mounted");
    expect(component).not.toHaveProperty("willUnmount");
    expect(fixture.innerHTML).toBe("<div>hey</div>");
    expect(steps).toEqual(["mounted"]);
    component.unmount();
    expect(fixture.innerHTML).toBe("");
    expect(steps).toEqual(["mounted", "willunmount"]);
  });

  test("can use onMounted, onWillUnmount, part 2", async () => {
    const steps: string[] = [];
    function useMyHook() {
      onMounted(() => {
        steps.push("mounted");
      });
      onWillUnmount(() => {
        steps.push("willunmount");
      });
    }
    class MyComponent extends Component<any, any> {
      static template = xml`<div>hey</div>`;
      constructor(env) {
        super(env);
        useMyHook();
      }
    }

    class Parent extends Component<any, any> {
      static template = xml`<div><MyComponent t-if="state.flag"/></div>`;
      static components = { MyComponent };
      state = useState({ flag: true });
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>hey</div></div>");
    expect(steps).toEqual(["mounted"]);

    parent.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(steps).toEqual(["mounted", "willunmount"]);
  });

  test("mounted, willUnmount, onMounted, onWillUnmount order", async () => {
    const steps: string[] = [];
    function useMyHook() {
      onMounted(() => {
        steps.push("hook:mounted");
      });
      onWillUnmount(() => {
        steps.push("hook:willunmount");
      });
    }
    class MyComponent extends Component<any, any> {
      static template = xml`<div>hey</div>`;
      constructor(env) {
        super(env);
        useMyHook();
      }
      mounted() {
        steps.push("comp:mounted");
      }
      willUnmount() {
        steps.push("comp:willunmount");
      }
    }
    const component = new MyComponent(env);
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>hey</div>");
    component.unmount();
    expect(fixture.innerHTML).toBe("");
    expect(steps).toEqual(["comp:mounted", "hook:mounted", "hook:willunmount", "comp:willunmount"]);
  });

  test("mounted, willUnmount, onMounted, onWillUnmount order, part 2", async () => {
    const steps: string[] = [];
    function useMyHook() {
      onMounted(() => {
        steps.push("hook:mounted");
      });
      onWillUnmount(() => {
        steps.push("hook:willunmount");
      });
    }
    class MyComponent extends Component<any, any> {
      static template = xml`<div>hey</div>`;
      constructor(env) {
        super(env);
        useMyHook();
      }
      mounted() {
        steps.push("comp:mounted");
      }
      willUnmount() {
        steps.push("comp:willunmount");
      }
    }

    class Parent extends Component<any, any> {
      static template = xml`<div><MyComponent t-if="state.flag"/></div>`;
      static components = { MyComponent };
      state = useState({ flag: true });
    }

    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>hey</div></div>");
    parent.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");

    expect(steps).toEqual(["comp:mounted", "hook:mounted", "hook:willunmount", "comp:willunmount"]);
  });

  test("two different call to mounted/willunmount should work", async () => {
    const steps: string[] = [];
    function useMyHook(i) {
      onMounted(() => {
        steps.push("hook:mounted" + i);
      });
      onWillUnmount(() => {
        steps.push("hook:willunmount" + i);
      });
    }
    class MyComponent extends Component<any, any> {
      static template = xml`<div>hey</div>`;
      constructor(env) {
        super(env);
        useMyHook(1);
        useMyHook(2);
      }
    }
    const component = new MyComponent(env);
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>hey</div>");
    component.unmount();
    expect(fixture.innerHTML).toBe("");
    expect(steps).toEqual([
      "hook:mounted1",
      "hook:mounted2",
      "hook:willunmount2",
      "hook:willunmount1"
    ]);
  });

  test("useRef hook", async () => {
    class Counter extends Component<any, any> {
      static template = xml`<div><button t-ref="button"><t t-esc="value"/></button></div>`;
      button = useRef("button");
      value = 0;
      increment() {
        this.value++;
        (this.button.el as HTMLButtonElement).innerHTML = String(this.value);
      }
    }
    const counter = new Counter(env);
    await counter.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><button>0</button></div>");
    counter.increment();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><button>1</button></div>");
  });

  test("useRef hook is null if ref is removed ", async () => {
    expect.assertions(4);
    class TestRef extends Component<any, any> {
      static template = xml`<div><span t-if="state.flag" t-ref="span">owl</span></div>`;
      spanRef = useRef("span");
      state = useState({ flag: true });
      willPatch() {
        expect(this.spanRef.el).not.toBeNull();
      }
      patched() {
        expect(this.spanRef.el).toBeNull();
      }
    }
    const component = new TestRef(env);
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>owl</span></div>");
    component.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
  });

  test("can use onPatched, onWillPatch", async () => {
    const steps: string[] = [];
    function useMyHook() {
      onWillPatch(() => {
        steps.push("willPatch");
      });
      onPatched(() => {
        steps.push("patched");
      });
    }

    class MyComponent extends Component<any, any> {
      static template = xml`<div><t t-if="state.flag">hey</t></div>`;
      state = useState({ flag: true });

      constructor(env) {
        super(env);
        useMyHook();
      }
    }

    const component = new MyComponent(env);
    await component.mount(fixture);
    expect(component).not.toHaveProperty("patched");
    expect(component).not.toHaveProperty("willPatch");
    expect(steps).toEqual([]);

    expect(fixture.innerHTML).toBe("<div>hey</div>");
    component.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");

    expect(steps).toEqual(["willPatch", "patched"]);
  });

  test("patched, willPatch, onPatched, onWillPatch order", async () => {
    const steps: string[] = [];
    function useMyHook() {
      onPatched(() => {
        steps.push("hook:patched");
      });
      onWillPatch(() => {
        steps.push("hook:willPatch");
      });
    }
    class MyComponent extends Component<any, any> {
      static template = xml`<div><t t-if="state.flag">hey</t></div>`;
      state = useState({ flag: true });

      constructor(env) {
        super(env);
        useMyHook();
      }
      willPatch() {
        steps.push("comp:willPatch");
      }
      patched() {
        steps.push("comp:patched");
      }
    }
    const component = new MyComponent(env);
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>hey</div>");
    component.state.flag = false;
    await nextTick();

    expect(steps).toEqual(["hook:willPatch", "comp:willPatch", "comp:patched", "hook:patched"]);
  });

  test("two different call to willPatch/patched should work", async () => {
    const steps: string[] = [];
    function useMyHook(i) {
      onPatched(() => {
        steps.push("hook:patched" + i);
      });
      onWillPatch(() => {
        steps.push("hook:willPatch" + i);
      });
    }
    class MyComponent extends Component<any, any> {
      static template = xml`<div>hey<t t-esc="state.value"/></div>`;
      state = useState({ value: 1 });
      constructor(env) {
        super(env);
        useMyHook(1);
        useMyHook(2);
      }
    }
    const component = new MyComponent(env);
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>hey1</div>");
    component.state.value++;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>hey2</div>");

    expect(steps).toEqual(["hook:willPatch2", "hook:willPatch1", "hook:patched1", "hook:patched2"]);
  });

  describe("autofocus hook", () => {
    function useAutofocus(name) {
      let ref = useRef(name);
      let isInDom = false;
      function updateFocus() {
        if (!isInDom && ref.el) {
          isInDom = true;
          ref.el.focus();
        } else if (isInDom && !ref.el) {
          isInDom = false;
        }
      }
      onPatched(updateFocus);
      onMounted(updateFocus);
    }

    test("simple input", async () => {
      class SomeComponent extends Component<any, any> {
        static template = xml`
            <div>
                <input t-ref="input1"/>
                <input t-ref="input2"/>
            </div>`;

        constructor(env) {
          super(env);
          useAutofocus("input2");
        }
      }

      const component = new SomeComponent(env);
      await component.mount(fixture);
      expect(fixture.innerHTML).toBe("<div><input><input></div>");
      const input2 = fixture.querySelectorAll("input")[1];
      expect(input2).toBe(document.activeElement);
    });

    test("input in a t-if", async () => {
      class SomeComponent extends Component<any, any> {
        static template = xml`
            <div>
                <input t-ref="input1"/>
                <t t-if="state.flag"><input t-ref="input2"/></t>
            </div>`;

        state = useState({ flag: false });
        constructor(env) {
          super(env);
          useAutofocus("input2");
        }
      }

      const component = new SomeComponent(env);
      await component.mount(fixture);
      expect(fixture.innerHTML).toBe("<div><input></div>");
      expect(document.activeElement).toBe(document.body);

      component.state.flag = true;
      await nextTick();
      const input2 = fixture.querySelectorAll("input")[1];
      expect(input2).toBe(document.activeElement);
    });
  });

  test("can use sub env", async () => {
    class TestComponent extends Component<any, any> {
      static template = xml`<div><t t-esc="env.val"/></div>`;
      constructor(env) {
        super(env);
        useSubEnv({ val: 3 });
      }
    }
    const component = new TestComponent(env);
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>3</div>");
    expect(env).not.toHaveProperty("val");
    expect(component.env).toHaveProperty("val");
  });

  test("parent and child env", async () => {
    class Child extends Component<any, any> {
      static template = xml`<div><t t-esc="env.val"/></div>`;
      constructor(env) {
        super(env);
        useSubEnv({ val: 5 });
      }
    }

    class Parent extends Component<any, any> {
      static template = xml`<div><t t-esc="env.val"/><Child/></div>`;
      static components = { Child };
      constructor(env) {
        super(env);
        useSubEnv({ val: 3 });
      }
    }
    const component = new Parent(env);
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>3<div>5</div></div>");
  });

  test("can use onWillStart, onWillUpdateProps", async () => {
    const steps: string[] = [];
    function useMyHook() {
      onWillStart(() => {
        steps.push("onWillStart");
      });
      onWillUpdateProps(nextProps => {
        expect(nextProps).toEqual({ value: 2 });
        steps.push("onWillUpdateProps");
      });
    }
    class MyComponent extends Component<any, any> {
      static template = xml`<span><t t-esc="props.value"/></span>`;
      constructor(parent, props) {
        super(parent, props);
        useMyHook();
      }
    }
    class App extends Component<any, any> {
      static template = xml`<div><MyComponent value="state.value"/></div>`;
      static components = { MyComponent };
      state = useState({ value: 1 });
    }

    const app = new App(env);
    await app.mount(fixture);
    expect(app).not.toHaveProperty("willStart");
    expect(app).not.toHaveProperty("willUpdateProps");
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
    expect(steps).toEqual(["onWillStart"]);

    app.state.value = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>2</span></div>");
    expect(steps).toEqual(["onWillStart", "onWillUpdateProps"]);
  });
});
